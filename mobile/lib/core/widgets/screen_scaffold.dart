import 'package:flutter/material.dart';

import '../layout/responsive.dart';
import '../theme/app_palette.dart';

/// Standard page frame: Material surface, safe area, responsive padding, a readable maximum
/// width (centered on tablets) and optional scrolling / pull-to-refresh.
/// Every screen goes through this so spacing stays uniform.
class ScreenScaffold extends StatelessWidget {
  const ScreenScaffold({
    required this.child,
    super.key,
    this.scroll = false,
    this.padded = true,
    this.centered = false,
    this.onRefresh,
  });

  final Widget child;
  final bool scroll;
  final bool padded;

  /// Vertically centers short content (auth screens).
  final bool centered;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final padding = padded
        ? EdgeInsets.all(context.pagePadding)
        : EdgeInsets.zero;
    Widget body;

    if (scroll) {
      body = LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          physics: onRefresh != null
              ? const AlwaysScrollableScrollPhysics()
              : null,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: padding,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: centered
                  ? constraints.maxHeight - padding.vertical
                  : 0,
            ),
            child: centered ? Center(child: child) : child,
          ),
        ),
      );
    } else {
      body = Padding(padding: padding, child: child);
    }

    if (onRefresh != null) {
      body = RefreshIndicator(onRefresh: onRefresh!, child: body);
    }

    // A Material (not just a ColoredBox): pages opened above the tab bar have
    // no Scaffold of their own, and without a Material ancestor every
    // InkWell/TextButton/TextField throws "No Material widget found" and plain
    // Text gets the yellow debug underline.
    return Material(
      color: context.palette.background,
      child: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: Breakpoints.contentMaxWidth,
            ),
            child: body,
          ),
        ),
      ),
    );
  }
}

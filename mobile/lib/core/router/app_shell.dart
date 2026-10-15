import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../l10n/l10n_x.dart';
import '../theme/app_palette.dart';

/// Bottom navigation around a [StatefulShellRoute]: Home and Account.
/// Each tab keeps its own navigation stack and scroll position. Labels are
/// resolved here (not in the route table) so they follow the language switch.
class AppShell extends StatelessWidget {
  const AppShell({required this.shell, super.key});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final p = context.palette;

    final items = [
      (Icons.home_outlined, Icons.home_rounded, l10n.navHome),
      (Icons.person_outline_rounded, Icons.person_rounded, l10n.navAccount),
    ];

    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: p.surface,
          surfaceTintColor: Colors.transparent,
          indicatorColor: p.primary.withValues(alpha: 0.12),
          iconTheme: WidgetStateProperty.resolveWith(
            (states) => IconThemeData(
              color: states.contains(WidgetState.selected)
                  ? p.primary
                  : p.textMuted,
            ),
          ),
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => TextStyle(
              fontSize: 12,
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w700
                  : FontWeight.w500,
              color: states.contains(WidgetState.selected)
                  ? p.primary
                  : p.textMuted,
            ),
          ),
        ),
        child: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: (index) => shell.goBranch(
            index,
            // Tapping the active tab returns to its root.
            initialLocation: index == shell.currentIndex,
          ),
          destinations: [
            for (final (icon, selectedIcon, label) in items)
              NavigationDestination(
                icon: Icon(icon),
                selectedIcon: Icon(selectedIcon),
                label: label,
              ),
          ],
        ),
      ),
    );
  }
}

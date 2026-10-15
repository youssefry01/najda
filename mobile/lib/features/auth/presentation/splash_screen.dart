import 'package:flutter/material.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/widgets/app_logo.dart';

/// Shown while the session resolves (Firebase restoring the saved login and
/// the profile being fetched). Matches the native splash so the hand-off from
/// the OS launch screen is seamless. No timers: the router leaves this screen
/// the moment the auth state is known.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  static const _brandRed = Color(0xFFD91F26);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      backgroundColor: _brandRed,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AppLogo(
                  variant: AppLogoVariant.stackedOnBrand,
                  size: 168,
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.splashTagline,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    height: 1.4,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: 120,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      minHeight: 4,
                      backgroundColor: Colors.white.withValues(alpha: 0.35),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

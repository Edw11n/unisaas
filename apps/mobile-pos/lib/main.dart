import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/session/session.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/dashboard/presentation/dashboard_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Restaura la sesion del keystore (si existe) antes de montar la app.
  final restoredSession = await SessionStore.restore();

  runApp(
    ProviderScope(
      overrides: [
        initialSessionProvider.overrideWithValue(restoredSession),
      ],
      child: const UnisaasMobileApp(),
    ),
  );
}

class UnisaasMobileApp extends StatelessWidget {
  final Widget? homeWidget;
  const UnisaasMobileApp({super.key, this.homeWidget});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'UNISAAS Movil',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: Colors.white,
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF5A52F8),
          secondary: Color(0xFF8EB5F8),
          surface: Colors.white,
          error: Color(0xFFEF4444),
          onPrimary: Colors.white,
          onSecondary: Colors.white,
          onSurface: Color(0xFF1E293B),
          onError: Colors.white,
        ),
      ),
      home: homeWidget ?? const _SessionGate(),
      routes: {
        '/login': (_) => const MobileLoginScreen(),
        '/dashboard': (_) => const MobileDashboardScreen(),
      },
    );
  }
}

/// Punto de entrada real: sin sesion autenticada no se puede operar el POS,
/// porque el BFF rechaza catalogo y checkout con HTTP 401.
class _SessionGate extends ConsumerWidget {
  const _SessionGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    if (session == null || !session.isAuthenticated) {
      return const MobileLoginScreen();
    }
    return const MobileDashboardScreen();
  }
}

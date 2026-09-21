// lib/main.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app_state.dart';
import 'screens/login_screen.dart';
import 'screens/mode_selector_screen.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState(),
      child: const UmlCollabApp(),
    ),
  );
}

class UmlCollabApp extends StatelessWidget {
  const UmlCollabApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'UML Collab',
      theme: ThemeData(colorSchemeSeed: const Color(0xFF4F7CFF), useMaterial3: true),
      home: const _Bootstrapper(),
    );
  }
}

class _Bootstrapper extends StatefulWidget {
  const _Bootstrapper();

  @override
  State<_Bootstrapper> createState() => _BootstrapperState();
}

class _BootstrapperState extends State<_Bootstrapper> {
  @override
  void initState() {
    super.initState();
    context.read<AppState>().bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (!app.ready) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return app.isLoggedIn ? const ModeSelectorScreen() : const LoginScreen();
  }
}

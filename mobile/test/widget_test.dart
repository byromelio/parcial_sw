// Smoke test de LoginScreen aislada (no de la app completa): reemplaza el
// placeholder de "Counter increments" que dejó flutter create (esta app
// nunca tuvo un contador) y que además no compilaba porque referenciaba
// una clase MyApp que nunca existió en este proyecto.
//
// No se testea UmlCollabApp/main.dart de punta a punta acá porque
// AppState() instancia SpeechRecognitionService en su declaración de
// campo, que carga la librería nativa de Vosk (libvosk.dll/.so) al
// construirse -- esa librería no existe en el entorno de test de
// escritorio (ni en CI), así que cualquier widget test que construya un
// AppState real falla por un problema de plataforma, no de lógica. Un
// test de integración real de la app completa solo tiene sentido
// corriendo en un dispositivo/emulador Android de verdad.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:uml_collab_mobile/screens/login_screen.dart';

void main() {
  testWidgets('LoginScreen muestra el formulario de acceso', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));

    expect(find.text('UML Collab'), findsOneWidget);
    expect(find.text('Ingresar'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2)); // email + password
  });
}

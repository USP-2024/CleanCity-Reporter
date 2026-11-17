import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

typedef SimMessageHandler = void Function(Map<String, dynamic> message);

/// Hosts the 3D scenes (Three.js, in assets/sim/) inside a WebView and passes
/// messages in both directions:
///   Flutter -> 3D : start(), update(), uploadResult()
///   3D -> Flutter : JSON messages such as {type: 'photo', ...} or {type: 'openReport', id: ...}
class SimView extends StatefulWidget {
  /// 'cleaner' (worker simulator) or 'control_room' (admin CCTV).
  final String mode;
  final Map<String, dynamic> data;
  final SimMessageHandler onMessage;

  const SimView({
    super.key,
    required this.mode,
    required this.data,
    required this.onMessage,
  });

  @override
  State<SimView> createState() => SimViewState();
}

class SimViewState extends State<SimView> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0E1A14))
      ..addJavaScriptChannel('Flutter', onMessageReceived: _onJsMessage)
      ..setNavigationDelegate(
        NavigationDelegate(onPageFinished: (_) => _startScene()),
      )
      ..loadFlutterAsset('assets/sim/index.html');
  }

  void _startScene() {
    _run(
      'window.CleanSim && CleanSim.start(${jsonEncode(widget.mode)}, ${jsonEncode(widget.data)});',
    );
  }

  DateTime _lastError = DateTime.fromMillisecondsSinceEpoch(0);

  void _onJsMessage(JavaScriptMessage message) {
    try {
      final decoded = jsonDecode(message.message);
      if (decoded is Map) {
        final map = Map<String, dynamic>.from(decoded);
        if (map['type'] == 'jsError') {
          // show at most one error message every 5 seconds
          final now = DateTime.now();
          if (now.difference(_lastError).inSeconds < 5) return;
          _lastError = now;
        }
        widget.onMessage(map);
      }
    } catch (_) {
      // ignore messages that are not valid JSON
    }
  }

  Future<void> _run(String js) async {
    try {
      await _controller.runJavaScript(js);
    } catch (_) {
      // the page may not be ready yet; ignore
    }
  }

  /// Control room: send fresh reports / simulations to the 3D scene.
  Future<void> update(Map<String, dynamic> data) =>
      _run('window.CleanSim && CleanSim.update(${jsonEncode(data)});');

  /// Worker simulator: tell the 3D scene whether the photo upload worked.
  Future<void> uploadResult(bool ok, String message) => _run(
    'window.CleanSim && CleanSim.uploadResult($ok, ${jsonEncode(message)});',
  );

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(
      controller: _controller,
      // Without this, Flutter holds back drags until it knows no other widget wants them,
      // so rotating / pinching / the joystick would not respond. "Eager" = the 3D view
      // claims every touch that starts inside it.
      gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
        Factory<OneSequenceGestureRecognizer>(() => EagerGestureRecognizer()),
      },
    );
  }
}

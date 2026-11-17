import 'package:flutter/material.dart';

/// Drag the handle left/right to compare the BEFORE and AFTER photos.
class BeforeAfterSlider extends StatefulWidget {
  final String beforeUrl;
  final String afterUrl;
  final double height;

  const BeforeAfterSlider({
    super.key,
    required this.beforeUrl,
    required this.afterUrl,
    this.height = 260,
  });

  @override
  State<BeforeAfterSlider> createState() => _BeforeAfterSliderState();
}

class _BeforeAfterSliderState extends State<BeforeAfterSlider> {
  double _pos = 0.5; // 0 = all AFTER visible, 1 = all BEFORE visible

  Widget _img(String url) => Image.network(
    url,
    fit: BoxFit.cover,
    errorBuilder: (context, error, stack) => Container(
      color: Colors.grey.shade300,
      child: const Center(child: Icon(Icons.broken_image_outlined)),
    ),
  );

  Widget _tag(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      style: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: 12,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = widget.height;
        return GestureDetector(
          onHorizontalDragUpdate: (d) {
            setState(() => _pos = (_pos + d.delta.dx / w).clamp(0.0, 1.0));
          },
          child: SizedBox(
            width: w,
            height: h,
            child: Stack(
              children: [
                Positioned.fill(child: _img(widget.afterUrl)),
                Positioned.fill(
                  child: ClipRect(
                    clipper: _LeftClipper(_pos),
                    child: _img(widget.beforeUrl),
                  ),
                ),
                Positioned(
                  left: w * _pos - 1.5,
                  top: 0,
                  bottom: 0,
                  child: Container(width: 3, color: Colors.white),
                ),
                Positioned(
                  left: w * _pos - 20,
                  top: h / 2 - 20,
                  child: const CircleAvatar(
                    radius: 20,
                    backgroundColor: Colors.white,
                    child: Icon(Icons.swap_horiz, color: Colors.black87),
                  ),
                ),
                Positioned(
                  left: 10,
                  top: 10,
                  child: _tag('BEFORE', Colors.red.shade700),
                ),
                Positioned(
                  right: 10,
                  top: 10,
                  child: _tag('AFTER', Colors.green.shade700),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _LeftClipper extends CustomClipper<Rect> {
  final double fraction;
  _LeftClipper(this.fraction);

  @override
  Rect getClip(Size size) =>
      Rect.fromLTWH(0, 0, size.width * fraction, size.height);

  @override
  bool shouldReclip(covariant _LeftClipper oldClipper) =>
      oldClipper.fraction != fraction;
}

import 'package:flutter/material.dart';

class ServiceabilityWidget extends StatefulWidget {
  const ServiceabilityWidget({super.key});

  @override
  State<ServiceabilityWidget> createState() => _ServiceabilityWidgetState();
}

class _ServiceabilityWidgetState extends State<ServiceabilityWidget> {
  final TextEditingController _controller = TextEditingController(text: '452001');
  bool _isChecking = false;
  String? _resultMessage;
  bool _isSuccess = false;

  void _checkLocation() {
    setState(() {
      _isChecking = true;
    });

    Future.delayed(const Duration(milliseconds: 600), () {
      final pincode = _controller.text.trim();
      final validPincodes = ['452001', '452002', '452003', '452004', '452005', '452010', '452011'];
      final isIndore = validPincodes.contains(pincode) || pincode.startsWith('452');

      setState(() {
        _isChecking = false;
        _isSuccess = isIndore;
        _resultMessage = isIndore
            ? '✅ Serviceable in Indore, MP! 50-Min Urgent Service Available.'
            : '❌ Currently Elix services exclusively inside Indore, MP.';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x140F172A)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.location_on, color: Color(0xFF4F46E5)),
              SizedBox(width: 8),
              Text(
                'Check Indore Serviceability',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: 'Enter Pincode (e.g. 452001)',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _isChecking ? null : _checkLocation,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                child: _isChecking
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Check'),
              ),
            ],
          ),
          if (_resultMessage != null) ...[
            const SizedBox(height: 10),
            Text(
              _resultMessage!,
              style: TextStyle(
                color: _isSuccess ? const Color(0xFF059669) : Colors.red,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            )
          ]
        ],
      ),
    );
  }
}

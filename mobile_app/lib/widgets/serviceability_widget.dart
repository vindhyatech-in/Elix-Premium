import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

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
            ? '✅ Serviceable in Indore — 50-Min Express available.'
            : '❌ Elix currently only serves Indore, MP.';
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 16),
              const SizedBox(width: 6),
              Text(
                'Check Indore Serviceability',
                style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 12.5, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: TextField(
                    controller: _controller,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'Pincode (e.g. 452001)',
                      hintStyle: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textMuted),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.borderLight)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.borderLight)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 38,
                child: ElevatedButton(
                  onPressed: _isChecking ? null : _checkLocation,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 12.5, fontWeight: FontWeight.w700),
                  ),
                  child: _isChecking
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Check'),
                ),
              ),
            ],
          ),
          if (_resultMessage != null) ...[
            const SizedBox(height: 6),
            Text(
              _resultMessage!,
              style: TextStyle(
                fontFamily: 'Inter',
                color: _isSuccess ? AppColors.accentGreen : const Color(0xFFDC2626),
                fontWeight: FontWeight.w600,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

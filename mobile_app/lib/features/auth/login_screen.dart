import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_service.dart';
import '../../core/constants/app_colors.dart';

/// Email/username + password sign-in — the mobile app's only auth
/// entry point for now (see the plan's scope boundaries: no in-app
/// signup/phone-OTP, accounts are created on the web). On success,
/// either pops back to whatever screen pushed it, or runs
/// [onSuccess] instead (used by CartSheet to continue straight into
/// Checkout after logging in).
class LoginScreen extends StatefulWidget {
  final VoidCallback? onSuccess;
  const LoginScreen({super.key, this.onSuccess});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifier = _identifierCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (identifier.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your email/username and password.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthService>().login(identifier, password);
      if (!mounted) return;
      if (widget.onSuccess != null) {
        widget.onSuccess!();
      } else {
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.cardLight,
        elevation: 0,
        title: const Text('Sign In', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RichText(
              text: const TextSpan(children: [
                TextSpan(text: 'E', style: TextStyle(fontFamily: 'Inter', fontSize: 30, fontWeight: FontWeight.w900, color: AppColors.primary)),
                TextSpan(text: 'lix', style: TextStyle(fontFamily: 'Inter', fontSize: 30, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
              ]),
            ),
            const SizedBox(height: 6),
            const Text('Sign in to manage your bookings and profile.',
                style: TextStyle(fontFamily: 'Inter', fontSize: 14, color: AppColors.textSecondary)),
            const SizedBox(height: 28),
            const Text('Email or Username', style: TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            TextField(
              controller: _identifierCtrl,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(hintText: 'you@example.com'),
            ),
            const SizedBox(height: 16),
            const Text('Password', style: TextStyle(fontFamily: 'Inter', fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            const SizedBox(height: 6),
            TextField(
              controller: _passwordCtrl,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                hintText: '••••••••',
                suffixIcon: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded, color: AppColors.textMuted),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(fontFamily: 'Inter', color: Color(0xFFDC2626), fontSize: 13)),
            ],
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Sign In'),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              "Don't have an account? Sign up on the Elix website — this app signs in with an existing account.",
              style: TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

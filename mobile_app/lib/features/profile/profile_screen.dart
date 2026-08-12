import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/profile_repository.dart';
import '../../core/auth/auth_service.dart';
import '../../core/constants/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../auth/login_screen.dart';
import 'models/address.dart';

/// The Profile bottom-nav tab — mirrors templates/booking/pages/profile.html:
/// editable name/phone, read-only email, saved addresses (add/delete),
/// Logout. Change-password/delete-account are intentionally left off
/// this mobile v1 — see the plan's scope boundaries.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _loading = false;
  bool _loadedForSession = false;
  String? _error;
  String _email = '';
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  List<Address> _addresses = [];
  bool _saving = false;
  bool _showAddForm = false;
  final _labelCtrl = TextEditingController();
  final _textCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();

  ProfileRepository _repo() => ProfileRepository(context.read<AuthService>().client());

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _labelCtrl.dispose();
    _textCtrl.dispose();
    _pincodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = _repo();
      final results = await Future.wait([repo.fetchProfile(), repo.fetchAddresses()]);
      final profile = results[0] as ProfileData;
      setState(() {
        _email = profile.email;
        _firstNameCtrl.text = profile.firstName;
        _lastNameCtrl.text = profile.lastName;
        _phoneCtrl.text = profile.phone;
        _addresses = results[1] as List<Address>;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _repo().updateProfile(firstName: _firstNameCtrl.text.trim(), lastName: _lastNameCtrl.text.trim(), phone: _phoneCtrl.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated.'), behavior: SnackBarBehavior.floating));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addAddress() async {
    if (_textCtrl.text.trim().isEmpty) return;
    try {
      final address = await _repo().addAddress(
        label: _labelCtrl.text.trim().isEmpty ? 'Address' : _labelCtrl.text.trim(),
        text: _textCtrl.text.trim(),
        pincode: _pincodeCtrl.text.trim(),
      );
      setState(() {
        _addresses = [..._addresses, address];
        _showAddForm = false;
        _labelCtrl.clear();
        _textCtrl.clear();
        _pincodeCtrl.clear();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _deleteAddress(Address address) async {
    try {
      await _repo().deleteAddress(address.id);
      setState(() => _addresses = _addresses.where((a) => a.id != address.id).toList());
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (!auth.isLoggedIn) {
      _loadedForSession = false;
      return Scaffold(
        backgroundColor: AppColors.bgLight,
        appBar: AppBar(backgroundColor: AppColors.cardLight, elevation: 0, title: const Text('Profile', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, color: AppColors.textPrimary))),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.person_rounded, size: 48, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('Sign in to view your profile', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.textPrimary)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                  child: const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!_loadedForSession) {
      _loadedForSession = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    }

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.cardLight,
        elevation: 0,
        title: const Text('My Profile', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textPrimary),
            tooltip: 'Log out',
            onPressed: () async {
              await context.read<AuthService>().logout();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(child: Text(_error!, style: AppTheme.bodyMd))
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    _Card(
                      title: 'Account Details',
                      child: Column(
                        children: [
                          TextField(
                            controller: TextEditingController(text: _email),
                            enabled: false,
                            decoration: const InputDecoration(labelText: 'Email'),
                          ),
                          const SizedBox(height: 12),
                          TextField(controller: _firstNameCtrl, decoration: const InputDecoration(labelText: 'First name')),
                          const SizedBox(height: 12),
                          TextField(controller: _lastNameCtrl, decoration: const InputDecoration(labelText: 'Last name')),
                          const SizedBox(height: 12),
                          TextField(controller: _phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', hintText: '+91 98765 43210')),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: _saving ? null : _save,
                              child: _saving
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : const Text('Save Changes'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _Card(
                      title: 'Saved Addresses',
                      child: Column(
                        children: [
                          if (_addresses.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: Text('No saved addresses yet.', style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary, fontSize: 13)),
                            ),
                          ..._addresses.map((a) => Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: AppColors.bgLight, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.borderLight)),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(a.label, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13)),
                                          Text(a.text, style: AppTheme.bodySm),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, color: AppColors.textMuted, size: 20),
                                      onPressed: () => _deleteAddress(a),
                                    ),
                                  ],
                                ),
                              )),
                          TextButton.icon(
                            onPressed: () => setState(() => _showAddForm = !_showAddForm),
                            icon: const Icon(Icons.add_rounded, size: 18),
                            label: const Text('Add New Address'),
                          ),
                          if (_showAddForm)
                            Column(
                              children: [
                                TextField(controller: _labelCtrl, decoration: const InputDecoration(hintText: 'Label (Home, Office…)')),
                                const SizedBox(height: 8),
                                TextField(controller: _textCtrl, maxLines: 2, decoration: const InputDecoration(hintText: 'Full address')),
                                const SizedBox(height: 8),
                                TextField(controller: _pincodeCtrl, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(hintText: 'Pincode')),
                                const SizedBox(height: 8),
                                SizedBox(width: double.infinity, child: ElevatedButton(onPressed: _addAddress, child: const Text('Save Address'))),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _Card extends StatelessWidget {
  final String title;
  final Widget child;
  const _Card({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppTheme.cardDecoration(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.textPrimary)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

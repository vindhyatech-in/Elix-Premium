import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/cart/cart_model.dart';
import '../../core/constants/app_colors.dart';
import '../auth/login_screen.dart';
import '../checkout/checkout_screen.dart';

/// The cart overlay panel — mirrors
/// templates/booking/components/floating_cart.html: item list, coupon
/// field, subtotal/total, "Proceed to Booking". Opened as a modal
/// bottom sheet from the bottom nav's Cart tab (see main.dart), never a
/// page of its own, same as the web's slide-up panel.
class CartSheet extends StatefulWidget {
  const CartSheet({super.key});

  @override
  State<CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends State<CartSheet> {
  final _couponCtrl = TextEditingController();

  @override
  void dispose() {
    _couponCtrl.dispose();
    super.dispose();
  }

  void _proceed() {
    final nav = Navigator.of(context);
    final isLoggedIn = context.read<AuthService>().isLoggedIn;
    final coupon = _couponCtrl.text.trim();
    nav.pop();
    nav.push(MaterialPageRoute(
      builder: (_) => isLoggedIn
          ? CheckoutScreen(couponCode: coupon)
          : LoginScreen(onSuccess: () => nav.pushReplacement(MaterialPageRoute(
              builder: (_) => CheckoutScreen(couponCode: coupon),
            ))),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartModel>();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.cardLight,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 8, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Your Cart',
                        style: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: cart.isEmpty
                    ? const Center(
                        child: Text(
                          'Your cart is empty — add a service or package to get started.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontFamily: 'Inter', color: AppColors.textSecondary, fontSize: 14),
                        ),
                      )
                    : ListView.separated(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                        itemCount: cart.lines.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, i) => _CartLineTile(line: cart.lines[i]),
                      ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _couponCtrl,
                        decoration: InputDecoration(
                          hintText: 'Coupon code (try GLAM10)',
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.borderLight)),
                        ),
                        style: const TextStyle(fontFamily: 'Inter', fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  "Applied at checkout if valid.",
                  style: TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textMuted),
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.borderLight))),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Subtotal', style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary)),
                    Text('₹${cart.subtotal.toStringAsFixed(0)}',
                        style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w800, fontSize: 18, color: AppColors.textPrimary)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: cart.isEmpty ? null : _proceed,
                    child: const Text('Proceed to Booking'),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CartLineTile extends StatelessWidget {
  final CartLine line;
  const _CartLineTile({required this.line});

  @override
  Widget build(BuildContext context) {
    final cart = context.read<CartModel>();
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.bgLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              line.item.photoUrl,
              width: 56,
              height: 56,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                width: 56,
                height: 56,
                color: AppColors.primaryLight,
                child: const Icon(Icons.spa_rounded, color: AppColors.primary),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text('₹${line.unitPrice.toStringAsFixed(0)} each',
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          Container(
            decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  icon: const Icon(Icons.remove_rounded, color: Colors.white, size: 16),
                  onPressed: () => cart.updateQty(line, line.qty - 1),
                ),
                Text('${line.qty}', style: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700, color: Colors.white)),
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  icon: const Icon(Icons.add_rounded, color: Colors.white, size: 16),
                  onPressed: () => cart.updateQty(line, line.qty + 1),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

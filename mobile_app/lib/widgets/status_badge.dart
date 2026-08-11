import 'package:flutter/material.dart';
import '../core/constants/app_colors.dart';

enum BookingStatus { upcoming, onWay, inProgress, completed, cancelled }

extension BookingStatusX on BookingStatus {
  String get label {
    switch (this) {
      case BookingStatus.upcoming:
        return '● Upcoming';
      case BookingStatus.onWay:
        return '🚗 On The Way';
      case BookingStatus.inProgress:
        return '● In Progress';
      case BookingStatus.completed:
        return '✓ Completed';
      case BookingStatus.cancelled:
        return '✕ Cancelled';
    }
  }

  Color get color {
    switch (this) {
      case BookingStatus.upcoming:
        return AppColors.statusUpcoming;
      case BookingStatus.onWay:
        return AppColors.statusOnWay;
      case BookingStatus.inProgress:
        return AppColors.statusInProgress;
      case BookingStatus.completed:
        return AppColors.statusCompleted;
      case BookingStatus.cancelled:
        return AppColors.statusCancelled;
    }
  }

  Color get bgColor {
    return color.withValues(alpha: 0.1);
  }
}

/// Small status pill badge. Usage:
/// ```dart
/// StatusBadge(status: BookingStatus.upcoming)
/// ```
class StatusBadge extends StatelessWidget {
  final BookingStatus status;
  final bool compact;

  const StatusBadge({super.key, required this.status, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: status.bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: compact ? 11 : 12,
          fontWeight: FontWeight.w700,
          color: status.color,
        ),
      ),
    );
  }
}

/// Generic colored label pill — for offer badges, BESTSELLER, etc.
class LabelBadge extends StatelessWidget {
  final String text;
  final Color color;
  final Color bgColor;

  const LabelBadge({
    super.key,
    required this.text,
    this.color = Colors.white,
    this.bgColor = AppColors.accentGreen,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

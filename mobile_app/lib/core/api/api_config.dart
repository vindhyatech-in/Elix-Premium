/// Where the Django `api/` app lives. Currently set for Chrome/web
/// (`flutter run -d chrome`), which resolves `127.0.0.1`/`localhost`
/// normally since it's not a virtualized emulator network — change
/// this when running against something else:
/// - Android emulator: `http://10.0.2.2:8000` (its alias for the host's
///   own localhost — the emulator has its own virtual network)
/// - Physical device: `http://<your-machine's-LAN-IP>:8000`
/// - A deployed server: its real `https://` domain
///
/// Start the Django server with `python manage.py runserver 0.0.0.0:8000`
/// so it accepts connections from the emulator/device, not just localhost.
class ApiConfig {
  static const String baseUrl = 'http://127.0.0.1:8000';
}

/// Every photo field the Django API returns is either an absolute URL
/// (Cloudinary, or any `photo_url` link field) or a relative
/// `/static/...` path (the legacy static-asset fallback — see
/// `SiteImageMixin`/`CatalogItemBase.display_photo_url` on the Django
/// side) — this resolves either shape to something `Image.network` can
/// load without every model repeating the same ternary.
String resolvePhotoUrl(String path) => path.startsWith('http') ? path : '${ApiConfig.baseUrl}$path';

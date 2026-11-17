class AppUser {
  final String id;
  final String name;
  final String email;
  final String role; // citizen | worker | admin
  final String phone;
  final int points;

  AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.phone,
    required this.points,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
    id: (j['id'] ?? j['_id'] ?? '').toString(),
    name: (j['name'] ?? '').toString(),
    email: (j['email'] ?? '').toString(),
    role: (j['role'] ?? 'citizen').toString(),
    phone: (j['phone'] ?? '').toString(),
    points: ((j['points'] ?? 0) as num).toInt(),
  );
}

class StatusEntry {
  final String status;
  final String note;
  final String byName;
  final DateTime at;

  StatusEntry({
    required this.status,
    required this.note,
    required this.byName,
    required this.at,
  });

  factory StatusEntry.fromJson(Map<String, dynamic> j) => StatusEntry(
    status: (j['status'] ?? '').toString(),
    note: (j['note'] ?? '').toString(),
    byName: (j['byName'] ?? '').toString(),
    at: DateTime.tryParse((j['at'] ?? '').toString()) ?? DateTime.now(),
  );
}

class Report {
  final String id;
  final String title;
  final String description;
  final String category;
  final String ward;
  final String address;
  final String status;
  final double lat;
  final double lng;
  final String beforePhoto;
  final String afterPhoto;
  final String reporterId;
  final String reporterName;
  final String workerId;
  final String workerName;
  final List<String> upvoters;
  final bool citizenConfirmed;
  final String rejectionNote;
  final double? afterDistance;
  final List<StatusEntry> history;
  final DateTime createdAt;

  Report({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.ward,
    required this.address,
    required this.status,
    required this.lat,
    required this.lng,
    required this.beforePhoto,
    required this.afterPhoto,
    required this.reporterId,
    required this.reporterName,
    required this.workerId,
    required this.workerName,
    required this.upvoters,
    required this.citizenConfirmed,
    required this.rejectionNote,
    required this.afterDistance,
    required this.history,
    required this.createdAt,
  });

  bool get hasWorker => workerId.isNotEmpty;
  int get supportCount => upvoters.length;

  // A populated reference looks like {_id: "...", name: "..."}; an unpopulated one is just "id".
  static String _idOf(dynamic v) {
    if (v == null) return '';
    if (v is Map) return (v['_id'] ?? v['id'] ?? '').toString();
    return v.toString();
  }

  static String _nameOf(dynamic v) =>
      v is Map ? (v['name'] ?? '').toString() : '';

  factory Report.fromJson(Map<String, dynamic> j) {
    final coords = (j['location']?['coordinates'] as List?) ?? const [0, 0];
    final check = j['afterCheck'];
    final rawHistory = (j['statusHistory'] as List?) ?? const [];
    final rawUpvotes = (j['upvotes'] as List?) ?? const [];

    return Report(
      id: (j['_id'] ?? j['id'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      description: (j['description'] ?? '').toString(),
      category: (j['category'] ?? 'other').toString(),
      ward: (j['ward'] ?? '').toString(),
      address: (j['address'] ?? '').toString(),
      status: (j['status'] ?? 'reported').toString(),
      lng: (coords[0] as num).toDouble(),
      lat: (coords[1] as num).toDouble(),
      beforePhoto: (j['beforePhoto'] ?? '').toString(),
      afterPhoto: (j['afterPhoto'] ?? '').toString(),
      reporterId: _idOf(j['reportedBy']),
      reporterName: _nameOf(j['reportedBy']),
      workerId: _idOf(j['assignedTo']),
      workerName: _nameOf(j['assignedTo']),
      upvoters: rawUpvotes.map((e) => _idOf(e)).toList(),
      citizenConfirmed: j['citizenConfirmed'] == true,
      rejectionNote: (j['rejectionNote'] ?? '').toString(),
      afterDistance: check is Map && check['distance'] != null
          ? (check['distance'] as num).toDouble()
          : null,
      history: rawHistory
          .map((e) => StatusEntry.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      createdAt:
          DateTime.tryParse((j['createdAt'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

class AppNotification {
  final String id;
  final String message;
  final String reportId;
  final bool isRead;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    required this.message,
    required this.reportId,
    required this.isRead,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
    id: (j['id'] ?? '').toString(),
    message: (j['message'] ?? '').toString(),
    reportId: (j['reportId'] ?? '').toString(),
    isRead: j['isRead'] == true,
    createdAt:
        DateTime.tryParse((j['createdAt'] ?? '').toString()) ?? DateTime.now(),
  );
}

/// A worker's result from the 3D cleaning simulator.
class SimSubmission {
  final String id;
  final String workerId;
  final String workerName;
  final String scenario;
  final String photo;
  final int itemsCleaned;
  final int totalItems;
  final int durationSec;
  final String status; // pending | approved | rejected
  final String reviewNote;
  final String reviewerName;
  final DateTime createdAt;

  SimSubmission({
    required this.id,
    required this.workerId,
    required this.workerName,
    required this.scenario,
    required this.photo,
    required this.itemsCleaned,
    required this.totalItems,
    required this.durationSec,
    required this.status,
    required this.reviewNote,
    required this.reviewerName,
    required this.createdAt,
  });

  factory SimSubmission.fromJson(Map<String, dynamic> j) {
    final worker = j['worker'];
    final reviewer = j['reviewedBy'];
    return SimSubmission(
      id: (j['_id'] ?? j['id'] ?? '').toString(),
      workerId: worker is Map
          ? (worker['_id'] ?? worker['id'] ?? '').toString()
          : (worker ?? '').toString(),
      workerName: worker is Map ? (worker['name'] ?? '').toString() : '',
      scenario: (j['scenario'] ?? '').toString(),
      photo: (j['photo'] ?? '').toString(),
      itemsCleaned: ((j['itemsCleaned'] ?? 0) as num).toInt(),
      totalItems: ((j['totalItems'] ?? 0) as num).toInt(),
      durationSec: ((j['durationSec'] ?? 0) as num).toInt(),
      status: (j['status'] ?? 'pending').toString(),
      reviewNote: (j['reviewNote'] ?? '').toString(),
      reviewerName: reviewer is Map ? (reviewer['name'] ?? '').toString() : '',
      createdAt:
          DateTime.tryParse((j['createdAt'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

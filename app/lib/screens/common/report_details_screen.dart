import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api.dart';
import '../../widgets/before_after_slider.dart';
import '../../widgets/common.dart';
import '../worker/after_photo_screen.dart';

/// One report: photos, details, map, timeline, and the actions each role is allowed to take.
class ReportDetailsScreen extends StatefulWidget {
  final String reportId;
  const ReportDetailsScreen({super.key, required this.reportId});

  @override
  State<ReportDetailsScreen> createState() => _ReportDetailsScreenState();
}

class _ReportDetailsScreenState extends State<ReportDetailsScreen> {
  Report? _report;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get('/reports/${widget.reportId}');
      if (!mounted) return;
      setState(() {
        _report = Report.fromJson(Map<String, dynamic>.from(data['report']));
        _error = null;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  /// Runs an API action, shows a message, then reloads the report.
  Future<void> _act(
    Future<dynamic> Function() action,
    String successMessage,
  ) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      showMsg(context, successMessage);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showMsg(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ------------------------------------------------------------ actions

  void _upvote() => _act(
    () => Api.post('/reports/${_report!.id}/upvote'),
    'Thanks! Your support was added',
  );

  void _confirm() => _act(
    () => Api.post('/reports/${_report!.id}/confirm'),
    'Thanks for confirming! +5 points',
  );

  void _startWork() => _act(
    () =>
        Api.patch('/reports/${_report!.id}/status', {'status': 'in_progress'}),
    'Marked as In Progress',
  );

  Future<void> _uploadAfterPhoto() async {
    final done = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => AfterPhotoScreen(report: _report!)),
    );
    if (done == true) {
      if (mounted)
        showMsg(context, 'After photo uploaded. Waiting for admin review.');
      _load();
    }
  }

  Future<void> _assign() async {
    List<AppUser> workers;
    try {
      final data = await Api.get('/users', query: {'role': 'worker'});
      workers = (data['users'] as List)
          .map((e) => AppUser.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on ApiException catch (e) {
      if (mounted) showMsg(context, e.message, error: true);
      return;
    }
    if (!mounted) return;
    if (workers.isEmpty) {
      showMsg(
        context,
        'There are no workers yet. Make a user a worker from the Users tab.',
        error: true,
      );
      return;
    }
    final chosen = await showDialog<AppUser>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Assign to worker'),
        children: [
          for (final w in workers)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, w),
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(child: Icon(Icons.engineering)),
                title: Text(w.name),
                subtitle: Text(w.email),
              ),
            ),
        ],
      ),
    );
    if (chosen == null) return;
    _act(
      () =>
          Api.patch('/reports/${_report!.id}/assign', {'workerId': chosen.id}),
      'Assigned to ${chosen.name}',
    );
  }

  void _approve() => _act(
    () => Api.patch('/reports/${_report!.id}/review', {'approve': true}),
    'Approved. Report resolved.',
  );

  Future<void> _reject() async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject after photo'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Reason for the worker',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    final note = controller.text.trim();
    if (ok != true) return;
    _act(
      () => Api.patch('/reports/${_report!.id}/review', {
        'approve': false,
        'note': note,
      }),
      'Photo rejected. The worker was notified.',
    );
  }

  Future<void> _edit() async {
    final r = _report!;
    final title = TextEditingController(text: r.title);
    final desc = TextEditingController(text: r.description);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit report'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: desc,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    final newTitle = title.text.trim();
    final newDesc = desc.text.trim();
    if (ok != true || newTitle.isEmpty) return;
    _act(
      () => Api.put('/reports/${r.id}', {
        'title': newTitle,
        'description': newDesc,
      }),
      'Report updated',
    );
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this report?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await Api.delete('/reports/${_report!.id}');
      if (!mounted) return;
      showMsg(context, 'Report deleted');
      Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showMsg(context, e.message, error: true);
      }
    }
  }

  // ----------------------------------------------------------------- UI

  Widget _button(
    IconData icon,
    String label,
    VoidCallback onTap, {
    bool outlined = false,
    Color? color,
  }) {
    final onPressed = _busy ? null : onTap;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: SizedBox(
        width: double.infinity,
        child: outlined
            ? OutlinedButton.icon(
                onPressed: onPressed,
                icon: Icon(icon),
                label: Text(label),
                style: OutlinedButton.styleFrom(foregroundColor: color),
              )
            : FilledButton.icon(
                onPressed: onPressed,
                icon: Icon(icon),
                label: Text(label),
                style: color == null
                    ? null
                    : FilledButton.styleFrom(backgroundColor: color),
              ),
      ),
    );
  }

  List<Widget> _actions(Report r, AppUser? u) {
    final out = <Widget>[];
    if (u == null) return out;
    final isOwner = r.reporterId == u.id;

    if (u.role == 'citizen') {
      final supported = r.upvoters.contains(u.id);
      if (!isOwner && r.status != 'resolved' && !supported) {
        out.add(
          _button(
            Icons.thumb_up_alt_outlined,
            'Me too - I see this problem as well',
            _upvote,
          ),
        );
      }
      if (!isOwner && supported) {
        out.add(
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text('You supported this report.'),
          ),
        );
      }
      if (isOwner && r.status == 'resolved' && !r.citizenConfirmed) {
        out.add(
          _button(Icons.check_circle_outline, "Yes, it's cleaned", _confirm),
        );
      }
      if (isOwner && r.status == 'reported') {
        out.add(
          _button(Icons.edit_outlined, 'Edit report', _edit, outlined: true),
        );
        out.add(
          _button(
            Icons.delete_outline,
            'Delete report',
            _delete,
            outlined: true,
            color: Colors.red.shade700,
          ),
        );
      }
    }

    if (u.role == 'worker' && r.workerId == u.id) {
      if (r.status == 'assigned')
        out.add(_button(Icons.play_arrow, 'Start work', _startWork));
      if (r.status == 'assigned' || r.status == 'in_progress') {
        out.add(
          _button(Icons.camera_alt, 'Upload after photo', _uploadAfterPhoto),
        );
      }
    }

    if (u.role == 'admin') {
      if (r.status == 'reported' || r.status == 'assigned') {
        out.add(
          _button(
            Icons.person_add_alt,
            r.hasWorker ? 'Reassign worker' : 'Assign worker',
            _assign,
          ),
        );
      }
      if (r.status == 'pending_review') {
        out.add(
          _button(
            Icons.check,
            'Approve after photo',
            _approve,
            color: Colors.green.shade700,
          ),
        );
        out.add(
          _button(
            Icons.close,
            'Reject after photo',
            _reject,
            outlined: true,
            color: Colors.red.shade700,
          ),
        );
      }
      out.add(
        _button(
          Icons.delete_outline,
          'Delete report',
          _delete,
          outlined: true,
          color: Colors.red.shade700,
        ),
      );
    }
    return out;
  }

  Widget _info(IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey.shade700),
        const SizedBox(width: 8),
        Expanded(child: Text(text)),
      ],
    ),
  );

  Widget _miniMap(Report r) {
    final point = LatLng(r.lat, r.lng);
    return SizedBox(
      height: 160,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: FlutterMap(
          options: MapOptions(
            initialCenter: point,
            initialZoom: 16,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.none,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: tileUrl,
              userAgentPackageName: tileUserAgent,
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: point,
                  width: 40,
                  height: 40,
                  alignment: Alignment.topCenter,
                  child: Icon(
                    Icons.location_on,
                    size: 40,
                    color: statusColor(r.status),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _timeline(Report r) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Timeline',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 4),
        for (final h in r.history.reversed)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.circle, size: 14, color: statusColor(h.status)),
            title: Text(statusLabels[h.status] ?? h.status),
            subtitle: Text(
              '${h.note.isEmpty ? '' : '${h.note}\n'}${h.byName}  |  ${fmtDate(h.at)}',
            ),
            isThreeLine: h.note.isNotEmpty,
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null || _report == null) {
      body = ErrorView(
        message: _error ?? 'Could not load this report',
        onRetry: () {
          setState(() => _loading = true);
          _load();
        },
      );
    } else {
      final r = _report!;
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            if (r.afterPhoto.isNotEmpty) ...[
              BeforeAfterSlider(
                beforeUrl: imageUrl(r.beforePhoto),
                afterUrl: imageUrl(r.afterPhoto),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Center(
                  child: Text(
                    'Drag the handle to compare',
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
                  ),
                ),
              ),
            ] else
              NetImage(r.beforePhoto, width: double.infinity, height: 240),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          r.title,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusChip(r.status),
                    ],
                  ),
                  const SizedBox(height: 6),
                  _info(
                    categoryIcon(r.category),
                    '${categories[r.category] ?? r.category}  |  ${r.ward}',
                  ),
                  if (r.address.isNotEmpty)
                    _info(Icons.place_outlined, r.address),
                  _info(
                    Icons.my_location,
                    'GPS: ${r.lat.toStringAsFixed(5)}, ${r.lng.toStringAsFixed(5)}',
                  ),
                  _info(
                    Icons.person_outline,
                    'Reported by ${r.reporterName.isEmpty ? 'a citizen' : r.reporterName} on ${fmtDate(r.createdAt)}',
                  ),
                  if (r.hasWorker)
                    _info(
                      Icons.engineering_outlined,
                      'Assigned to ${r.workerName}',
                    ),
                  if (r.supportCount > 0)
                    _info(
                      Icons.people_outline,
                      '${r.supportCount} other ${r.supportCount == 1 ? 'person' : 'people'} also reported this',
                    ),
                  if (r.afterDistance != null)
                    _info(
                      Icons.verified_outlined,
                      'After photo taken ${r.afterDistance!.toStringAsFixed(0)} m from the reported spot (GPS verified)',
                    ),
                  if (r.citizenConfirmed)
                    _info(
                      Icons.thumb_up_alt_outlined,
                      'The citizen confirmed this is cleaned',
                    ),
                  if (r.description.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(r.description),
                  ],
                  if (r.rejectionNote.isNotEmpty &&
                      r.status == 'in_progress') ...[
                    const SizedBox(height: 12),
                    Card(
                      color: Colors.red.shade50,
                      child: ListTile(
                        leading: Icon(
                          Icons.info_outline,
                          color: Colors.red.shade700,
                        ),
                        title: const Text('After photo was rejected'),
                        subtitle: Text(r.rejectionNote),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  _miniMap(r),
                  const SizedBox(height: 8),
                  ..._actions(r, user),
                  const SizedBox(height: 20),
                  _timeline(r),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Report details')),
      body: Stack(
        children: [
          Positioned.fill(child: body),
          if (_busy)
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(),
            ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';

/// Admin: see all users, promote a citizen to worker/admin, or delete a user.
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  List<AppUser> _users = [];
  bool _loading = true;
  String? _error;
  String _role = ''; // '' = all

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get(
        '/users',
        query: _role.isEmpty ? null : {'role': _role},
      );
      final list = (data['users'] as List)
          .map((e) => AppUser.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      if (!mounted) return;
      setState(() {
        _users = list;
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

  Future<void> _onMenu(AppUser user, String value) async {
    try {
      if (value == 'delete') {
        final ok = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('Delete ${user.name}?'),
            content: const Text('This cannot be undone.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        );
        if (ok != true) return;
        await Api.delete('/users/${user.id}');
        if (mounted) showMsg(context, 'User deleted');
      } else {
        await Api.patch('/users/${user.id}/role', {'role': value});
        if (mounted) showMsg(context, '${user.name} is now a $value');
      }
      _load();
    } on ApiException catch (e) {
      if (mounted) showMsg(context, e.message, error: true);
    }
  }

  IconData _roleIcon(String role) {
    switch (role) {
      case 'admin':
        return Icons.admin_panel_settings;
      case 'worker':
        return Icons.engineering;
      default:
        return Icons.person;
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthProvider>().user;

    Widget list;
    if (_loading) {
      list = const Center(child: CircularProgressIndicator());
    } else if (_error != null) {
      list = ErrorView(
        message: _error!,
        onRetry: () {
          setState(() => _loading = true);
          _load();
        },
      );
    } else {
      list = RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          itemCount: _users.length,
          itemBuilder: (context, i) {
            final u = _users[i];
            final isMe = me != null && me.id == u.id;
            return ListTile(
              leading: CircleAvatar(child: Icon(_roleIcon(u.role))),
              title: Text(isMe ? '${u.name} (you)' : u.name),
              subtitle: Text('${u.email}\n${u.role}  |  ${u.points} pts'),
              isThreeLine: true,
              trailing: isMe
                  ? null
                  : PopupMenuButton<String>(
                      onSelected: (v) => _onMenu(u, v),
                      itemBuilder: (ctx) => [
                        if (u.role != 'citizen')
                          const PopupMenuItem(
                            value: 'citizen',
                            child: Text('Make citizen'),
                          ),
                        if (u.role != 'worker')
                          const PopupMenuItem(
                            value: 'worker',
                            child: Text('Make worker'),
                          ),
                        if (u.role != 'admin')
                          const PopupMenuItem(
                            value: 'admin',
                            child: Text('Make admin'),
                          ),
                        const PopupMenuItem(
                          value: 'delete',
                          child: Text('Delete user'),
                        ),
                      ],
                    ),
            );
          },
        ),
      );
    }

    const roles = ['', 'citizen', 'worker', 'admin'];
    return Column(
      children: [
        SizedBox(
          height: 52,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            itemCount: roles.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            itemBuilder: (context, i) => ChoiceChip(
              label: Text(roles[i].isEmpty ? 'All' : roles[i]),
              selected: _role == roles[i],
              onSelected: (_) {
                setState(() {
                  _role = roles[i];
                  _loading = true;
                });
                _load();
              },
            ),
          ),
        ),
        Expanded(child: list),
      ],
    );
  }
}

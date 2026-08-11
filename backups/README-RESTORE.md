# PedalMap backup — pre UX overhaul (/ruta)

Created: 20260811T1228Z UTC
Git commit: 6771db729c35e8783e0129a4b7e0bbdfab61e51d
Git branch at backup: cursor/pedalmap-whatsapp-share-route-83e6
Backup branch: cursor/backup-pedalmap-pre-ux-83e6
Git tag: backup/pedalmap-pre-ux-20260811T1228Z

## Restore source from git
```bash
git fetch origin
git checkout cursor/backup-pedalmap-pre-ux-83e6
# or
git checkout backup/pedalmap-pre-ux-20260811T1228Z
```

## Restore from tarball
```bash
tar -xzf backups/pedalmap-source-pre-ux-20260811T1228Z.tar.gz
cd pedalmap && npm ci && npm run build
```

## Live site snapshot
See pedalmap-live-site-pre-ux-20260811T1228Z.tar.gz (HTML + main assets as deployed at backup time).

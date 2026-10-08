# Releasing

**A release auto-updates real people** — Nick's desktop and at least one other user's Windows
machine. That is the whole reason this document exists: nothing here is ceremony, every step is a
scar.

---

## 1. What a release actually is

| Thing | Reaches users? |
|---|---|
| A commit on `main` | ❌ no |
| Running `./install.sh` locally | only the machine you ran it on |
| A **tag** `vX.Y.Z` pushed to the remote | ✅ this is the release — CI builds installers and publishes |

Feature commits **never** carry a version. A release is a separate commit that bumps **BOTH**
`desktop/package.json` **and** `org.citylive.wallpaper/metadata.json`, then an annotated tag whose
message summarises what shipped. `git tag` reads as the changelog.

> 🚨 **TWO VERSIONS, ONE RELEASE — AND LEAVING THE SECOND OUT BROKE EVERY UPDATE FOR THREE MONTHS.**
> `desktop/package.json` is what the Electron/Windows build reports. `org.citylive.wallpaper/
> metadata.json` is what the **KDE plugin** reports, and it is the string the `citylive-update`
> auto-updater compares the downloaded tarball against. From the v2.0.0 "THE PEOPLE" bump onward this
> file was never touched again, so every 3.x and 4.0.0 tarball self-reported `2.0.2`, the updater
> rejected it as a mismatch, and **every install for three months was a manual `./install.sh`.** The
> bump step below used to name only `package.json` — the procedure itself was the bug. It names both
> now.

> ⚠ **A TAG ON THE REMOTE IS NOT A RELEASE.** `v3.24.0`'s tag reached the remote and no build ever
> fired — no run, no installer, no release. GitHub's "latest" stayed on the previous version and the
> auto-updater agreed with it. Nobody noticed for a day. **After pushing a tag, confirm the run
> started and the release published.** Pushing is not shipping.

---

## 2. The gate — Nick's standing rule (2026-07-16)

> *"Make sure we verify this works on both platforms before we update the GitHub, just as a rule."*

Do feature work on a **branch**, not `main`. CI can build artifacts from any branch without
releasing (`gh workflow run "Build CityLive desktop apps" --ref <branch>` — the `release` job is
correctly skipped). Only after **both** legs pass: merge, bump, tag.

### Leg 1 — KDE (his real tri-monitor desktop)
1. `node tools/sync-engine.js && cd desktop && npm test` — must be green; it also fails on engine drift.
2. `./install.sh` — ⚠ **restarts plasmashell. Check nothing is mid-game first.**
3. Confirm the config landed by grepping the **installed** `localcfg.js`, not the repo copy.
4. `journalctl --user -b` — zero CityLive entries. (KDE's own baloo/brightness/screencast noise is not ours.)
5. Look at the actual desktop. Renders at 0.5 fps in places; give it a minute.

### Leg 2 — Windows (the WinTest VM)
The failure mode this leg exists to catch is real: it was skipped for `v3.23.0` and `v3.24.0`, after
which a user hit a multi-monitor bug on Windows that the gate would have caught.

```bash
virsh -c qemu:///system start WinTest                  # ⚠ always -c qemu:///system
virsh -c qemu:///system net-dhcp-leases default        # → the guest IP
ssh -i ~/.ssh/vm_key admin@<ip>
```

> 🪤 **`ping` FAILS — Windows Firewall blocks ICMP by default.** Port 22 is open the whole time. A
> negative result from the wrong tool is not evidence of absence. This exact mistake produced a note
> claiming the VM was unreachable, which cost two releases.

1. Take the **CI installer**, not a local `--dir` build. (Cross-building from Linux omits the Windows
   koffi binding, so the packaged app cannot call user32 and the wallpaper attach dies. Real releases
   are built by CI on `windows-latest`.)
2. `scp` it over; install silently with `CityLive-Setup.exe /S` → `%LOCALAPPDATA%\Programs\CityLive`.
3. 🔑 **SSH lands in a NON-INTERACTIVE session — a GUI app launched from it has no desktop.** Create a
   scheduled task into the console session instead:
   `schtasks /create /tn X /tr <cmd> /sc once /st 00:00 /ru admin /it /f` then `/run`.
   Check `query session` first — console must be **Active**. ⚠ `%LOCALAPPDATA%` does not expand
   inside `/tr`; use the literal path. ⚠ `;` is not a cmd separator — use `&`.
4. **Screenshot from inside that task and scp the PNG back. That is the evidence.**
   ⚠ `MainWindowHandle` is **empty once the window is reparented into WorkerW**, which looks
   identical to "never opened". Do not read a handle as success or failure.
5. ⚠ PowerShell 5.1 traps: `Add-Type -AssemblyName A, B` fails but the task still exits
   `Last Result: 0` with no output — split into separate calls and write a marker line first.
   `GetElementsByTagName(...)[i]` throws "Collection was modified" — use `XmlDocument.LoadXml`.
6. An SSH-to-Windows shell prints *"The system cannot find the path specified."* as a startup
   artifact before real output. It is not the command failing.

> ⚠ **A single-head VM cannot verify a mixed-DPI multi-monitor fix.** Say so plainly rather than
> letting a green VM run imply it. Geometry expectations belong in unit tests
> (`multimon-geometry.test.js`) which run on the CI Windows leg and gate the installer.

---

## 3. Cutting it

```bash
# both legs green, on main
vim desktop/package.json                       # bump "version"        (Electron / Windows build)
vim org.citylive.wallpaper/metadata.json       # ⚠ bump "Version" TOO  (KDE plugin — THIS IS WHAT THE UPDATER READS)
git commit -am "vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — <what shipped, in his voice>"
git push                                       # the branch/main
git push origin vX.Y.Z                         # ⚠ THE TAG BY NAME — never `--tags`

gh run list --workflow "Build CityLive desktop apps" --limit 1   # ← CONFIRM IT FIRED
gh release list --limit 3                                        # ← CONFIRM IT PUBLISHED
```

> 🚨 **NEVER `git push --tags`.** It pushes every local tag, including ones that were never meant to
> leave this machine, and it is how a tag reached the remote with no build behind it. Push the one tag
> BY NAME so exactly one release can fire.

> ⚠ A release reads **`Draft` for ~30 s as a normal intermediate state** — the action uploads first
> and a final step flips it live. Don't diagnose a draft until the **release job itself** is
> `completed`. If all three `latest*.yml` assets are present, it is mid-publish, not broken.

The update path itself has been verified end-to-end: a VM on the previous build found the new
release, compared blockmaps and pulled a **differential download — 1.6 MB of 81 MB**. Worth
re-running whenever the updater or the release workflow is touched, because it is the only proof
that a fix actually *reaches* anyone.

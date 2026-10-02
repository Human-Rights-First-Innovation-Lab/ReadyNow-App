# Developer Certificate of Origin

ReadyNow uses the Developer Certificate of Origin (DCO) instead of a
contributor license agreement. There is nothing to sign and no form to fill in
— you certify the origin of your work by adding one line to each commit.

## How to sign off

Add `-s` when you commit:

```bash
git commit -s -m "fix(alerts): retry a failed send once before reporting failure"
```

Git appends a trailer using your configured name and email:

```text
Signed-off-by: Jane Doe <jane@example.com>
```

Set those once if you have not already:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

The email should be one you can be reached at. A GitHub `noreply` address is
fine; an obviously fake one is not.

### If you forgot

Amend the most recent commit:

```bash
git commit --amend -s --no-edit && git push --force-with-lease
```

For several commits, sign off the whole branch against `develop`:

```bash
git rebase --signoff develop && git push --force-with-lease
```

## CI enforces this

The `DCO Sign-off` job in CI checks every commit in your pull request. If one is
missing a sign-off, the check fails and the run summary lists the offending
commits and the command that fixes them.

Two exemptions: merge commits (they are not authored work, and are often
created by GitHub rather than by you) and commits from bots such as Dependabot.

The check compares the email in the `Signed-off-by:` line against the commit
author's email, case-insensitively. If you are sure you signed off but the
check still fails, the mismatch is almost always between `git config user.email`
and the address the commit was actually authored with — `git log -1 --format='%ae'`
shows the latter.

## What you are certifying

By signing off you agree to the Developer Certificate of Origin, version 1.1,
reproduced in full below. In short: you wrote the change, or you have the right
to submit it under [Apache License 2.0](LICENSE), and you understand that your
contribution and the sign-off are public and kept indefinitely.

If you are contributing as part of your job, note that your employer may own
the copyright in your work. Make sure you have their permission before you sign
off.

---

```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

# Retained dependency risks — web-page release, 2026-10-15

The public project-page release leaves the Expo/React Native dependency graph unchanged. The owner explicitly approved publishing the reviewed web landing while retaining and documenting these native-tooling risks. This is not approval to distribute a new native app or a claim that its dependencies are secure.

The full npm audit reports **15 high affected-package records arising from two advisories**. Parent propagation does not mean fifteen independent vulnerabilities:

| Advisory | Installed dependency / path | Issue | Published patch in checked advisory |
|---|---|---|---|
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | braces 3.0.3 via micromatch → metro-file-map → Expo/React Native tooling | Deeply nested patterns can exhaust the stack | None listed |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | node-forge 1.4.0 via Expo CLI/code-signing-certificates | RSA PKCS#1 v1.5 verification accepts extra nested DigestAlgorithm elements | None listed |

Primary GitHub advisory ranges and withdrawal status were checked. Expo 57.0.27, React Native 0.86.3, the lockfile and existing xcode/uuid override remain intact. npm's suggested moves to Expo 44.0.6 / React Native 0.72.17 are framework downgrades, not an acceptable automatic remedy. No override or audit suppression was added.

The public site is the separately built Vite landing from `landing/`, published as `docs/`; it does not publish the Expo app. These findings concern installed development/build/signing chains and do not demonstrate exploitation through the public brochure. They still matter when running native tooling, handling attacker-controlled patterns or verifying untrusted signatures. This review does not establish that every native invocation is unreachable or safe.

Before a native app release, revisit patched upstream releases and SDK compatibility, trace actual untrusted input/signature callers, then verify a bounded upgrade with native checks. Do not turn this web-only exception into a standing waiver for native distribution.

# Market characters

14 animated GLB models based on **Quaternius — Ultimate Animated Character Pack (November 2019)**.

- Creator and original pack: https://quaternius.com/packs/ultimatedanimatedcharacter
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- The pack's original Blender source downloads and individual output hashes are recorded in `asset-info.json`.
- Permission: free use, modification and redistribution, including commercial games.
- Police is a separate adapted model with a navy uniform, cap, badge and POLICJA lettering bound to the skeleton.
- Guard is a separate bald character with a broader upper body and dark clothing.
- Every model includes baked `idle` and `walk` animations, one vertex-colour material and meshopt compression. No external textures or third-party runtime requests.

To rebuild: download the source `.blend` files identified in `asset-info.json`, run `tools/build-characters.py` in Blender, then `tools/optimize-characters.mjs` with the game tools' existing glTF dependencies. Optimization takes the original source-file ID list as its third argument.

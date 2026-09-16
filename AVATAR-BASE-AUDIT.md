# Avatar base: inspection and incremental repair

Inspected 2026-09-15 using Blender 4.5.13 and scripts/inspect-roger-avatar.py.
Original input remains unchanged in the supplied Roger Blender project.

## Existing base

- Original armature: Roger; exported: Roger_Rig, 101 joints.
- Head landmark: CC_Base_Head. Eyes: CC_Base_L_Eye / CC_Base_R_Eye.
- Original body dimensions in Blender: 1.8845 × 0.3210 × 1.8327 m, arms extended.
- Original body origin: (0, 0, 0); armature location: (0, 0, -0.0696).
- Blender uses Z-up; exported GLTF geometry uses Y-up. Preserve the rig's bind
  transforms; apply user height once at the common figure root.
- Current web payload: 13,694,032 bytes in 21 binary parts, one GLTF skin.
- Separate meshes exist for body, eyes, tearline, occlusion, teeth, tongue,
  boxers, hair and four facial-hair pieces.
- Original source contains facial expression shape keys. Current export clears
  all of them and explicitly disables export_morph. Structural face controls
  consequently do not deform Roger. Expression keys are not interchangeable
  with structural jaw/nose/face proportion controls.

## Repairs implemented

- Camera bounds are measured after geometry/pose updates, excluding auras.
- Face framing uses the head landmark, with bounds fallback. Height and aspect
  ratio participate in fitting; anatomy mode no longer disables face focus.
- Five camera presets, smooth transitions, wheel and two-pointer zoom, rotation,
  front/back and reset. Repeated editor focus requests override manual presets.
- Keep the old Roger visible while replacement materials/model load. If initial
  loading fails, restore both procedural head and body.
- Hair length deforms upper tips relative to scalp bounds instead of scaling
  the skinned object around its origin. Cavanhaque hides cheek/neck hair pieces.
- Skin roughness is bounded away from a plastic/metal appearance.
- Editor has separate beard/skin tabs and explicit cancel/previous/default draft
  restoration. Existing account data and progression schema are unchanged.

## Still required for the complete requested editor

- Structural morph targets on the existing base and matching corrective targets
  on clothing; expose only controls that are verified on Roger.
- Canonical equipment slots and garment meshes sharing the Roger skeleton.
  Existing procedural clothes are not rigged to Roger and are not certified
  against clipping in animation or extreme body proportions.
- Hair catalogue with distinct fitted geometry, independent beard colour,
  lower-body items, preview transactions for equipment and animation checks.
- Mobile polygon/texture budget and asset-validation gate for future additions.
- End-to-end persistence in an authenticated deployment. Current localhost API
  reports that account/database connection is missing (503); a visible preview
  does not establish that a save succeeded.
- Delivery review for the CGTrader incorporated-product license; see
  public/avatar/ASSET-LICENSES.md.

## Verification so far

93 unit tests passed, including three new camera tests (height, bounds fallback,
viewport aspect and zoom limits). TypeScript and ESLint passed on the final working tree. Browser confirmed
manual face focus and wheel zoom on the local procedural preview. Physical
touch-device performance and Roger clothing animation remain unverified.

## 2026-09-15 — facial deformation and grounded wardrobe

- Roger now uses a relative runtime morph target for the existing facial controls; original vertex positions and topology remain intact. The same rest-space deformation is applied to eyes, hair and facial hair.
- Ground height is measured from the posed mesh. Clothing is fitted against hip, neck, arm and leg landmarks, including asynchronously loaded details. Repeated fitting starts from original positions.
- Validation: 96 existing/facial tests plus one wardrobe regression test passed; TypeScript and lint checked. Browser preview exercised masculine presentation and face width 1.15.
- Remaining: shoulder/hip seam clipping needs artist-authored garment topology and skin weights. Runtime fitting is not a completed Blender wardrobe or animation system. The local avatar API returns 503 without account/database; appearance persistence is not verified here.

# Photographic color study

The RGB medians and five-color clusters in `colors.json` were sampled from specific, visually inspected rectangular regions of these photographs. Crop coordinates refer to the original downloaded image dimensions. Photos are used for analysis only and are not distributed with the game.

- `summer.jpg`: [Kyoto Hannarism, summer garden](https://kyoto-hannarism.com/ryouanji-butsudennisinoniwasummer/), [photograph](https://i0.wp.com/kyoto-hannarism.com/wp-content/uploads/2022/09/fc531c2544bb4def9c160e6f4df79337.jpg?ssl=1&w=1440).
- `autumn-kyoto.jpg`: [Kyoto City Tourism Association, Ryōan-ji](https://ja.kyoto.travel/flower/momiji/single.php?flower_id=1218), [photograph](https://ja.kyoto.travel/resource/flower_momiji/1218-3.jpg).
- `autumn-jr.jpg`: [JR Central, 2024 Kyoto retrospective](https://souda-kyoto.jp/blog/01313.html), [photograph](https://souda-kyoto.jp/blog/t467g0000000g90c-img/1213ryoanji.jpg).

The photos have different exposure, processing, weather and white balance. These values are display-color references, not measured surface reflectance or botanical spectra. Sky and branch contamination in clusters must be excluded when selecting foliage anchors.

The summer gravel median is RGB 197/202/199, while the shaded gravel in the Kyoto autumn photo is 143/153/158. This motivates a neutral gray gravel material lit by warmer direct sunlight and cooler sky fill, rather than an intrinsically yellow sand texture. Wall samples retain their muted warm brown. Foliage uses distinct deep-green, crimson, orange and amber families, decoded from sRGB into Three.js linear working space.

Rendering uses linear display tone mapping at exposure 1, a neutral ground bounce, cool sky fill and mildly warm sunlight. This avoids the tested neutral mapper's black-level subtraction, which suppressed low red/blue channels in the forest. Leaf and canopy detail textures have neutral color channels so they do not apply a second green filter to autumn colors. The canopy's darkness comes primarily from light and shadow instead of a very dark base color multiplied by another dark texture. Final colors are checked in rendered summer/afternoon, summer/overcast and autumn/overcast views.

The 960×640 summer/afternoon lighting calibration (before the expanded seasonal planting families) produced representative RGB medians of 204/203/202 in lit gravel, 146/152/158 in shaded gravel, 148/125/100 on the wall, and 33/69/37 across the mixed forest. The reference crops above are different compositions; this is a range and cast check, not a pixel registration or an exact reconstruction. The corresponding photo medians are 197/202/199 for lit gravel, 143/153/158 for shaded gravel, 156/126/93 for wall, and 27/78/43 for summer evergreens.

Additional spring and winter photo sampling was completed before the second seasonal revision:

- `spring.jpg`: [Kyoto Burari photographer's April 2023 visit](https://www.kyotowalk-gourmet.com/entry/ryoanji_sakura), [photograph](https://cdn-ak.f.st-hatena.com/images/fotolife/k/kyotoburari/20230406/20230406095409.jpg).
- `winter.jpg`: [Take-boo photographer's January 2023 article](https://ameblo.jp/take-boo-s/entry-12785184746.html), [photograph](https://stat.ameba.jp/user_images/20230120/11/take-boo-s/0c/ac/j/o2048153615232168683.jpg).
- [NC State Extension: Japanese cedar](https://plants.ces.ncsu.edu/plants/cryptomeria-japonica/common-name/japanese-cryptomeria/) documents winter bronzing and variation among cultivars.
- [RHS: Acer palmatum](https://www.rhs.org.uk/plants/225/i-acer-palmatum-i/details) documents deciduous foliage and variable autumn color.

| Layer | Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- | --- |
| Lower broadleaf foliage | Muted fresh olive/yellow greens | Rich green | Olive and ochre undertones | Muted olive/brown green, retained foliage |
| Lower deciduous planting | Sparse young foliage and visible twigs | Full green | Rust/ochre/gold | Bare twigs |
| Middle maples | Sparse bronze/yellow-green new growth | Full green, individual tree variations | Crimson, scarlet, copper and amber | Bare branch structure |
| Cherry accent | Dusty pale pink blossom | Green leaves | Copper/brown-gold | Bare branches |
| High cedars | Dark olive-green with fresher tips | Deep green | Olive-green | Uneven dark olive to bronze-brown |
| High pines | Fresher green | Deep needle green | Muted olive-green | Retained dark green, less bronzing than cedar |
| Moss | Olive/yellow-green | Green | Ochre-green | Muted brown-olive |

These are photo-guided artistic plant families, not a surveyed inventory of Ryōan-ji's individual plants. Seasons are representative moments (early spring blossom and new leaves, full summer, autumn color, leafless winter), not fixed dates. The photos differ in light and exposure; the winter palette preserves the distinction between evergreen mass and bronzed foliage instead of turning every tree red. Pine, generic understory and moss transitions combine the scene references with artistic interpolation.

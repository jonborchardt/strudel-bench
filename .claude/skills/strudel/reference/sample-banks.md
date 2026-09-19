# Community sample banks

Strudel's `github:<owner>/<repo>` shortcut resolves to
`https://raw.githubusercontent.com/<owner>/<repo>/main/strudel.json`, with the pack's files under
`.../main/` (the `_base` inside that json). Nothing here loads one automatically: this harness only
knows the packs in `lib/packs.json`, and `npm run check` fails on a sound it has never seen.

To use one:

1. Add an entry to `lib/packs.json` (`base` explicit, because these repos usually write `_base` as a
   relative path and `scripts/samples.mjs` concatenates it as-is):

       "clean-breaks": {
         "json": "https://raw.githubusercontent.com/yaxu/clean-breaks/main/strudel.json",
         "base": "https://raw.githubusercontent.com/yaxu/clean-breaks/main/"
       }

2. `npm run samples -- clean-breaks` (downloads into `samples/packs/`, gitignored; the generated
   `.json` map is committed so `npm run check` knows the names on a fresh clone).
3. The page streams the same pack from those URLs when nothing is downloaded, so it also works on
   Pages — but check the repo's license before shipping it.

| Bank | Shortcut |
| --- | --- |
| algorave-dave/samples | `github:algorave-dave/samples` |
| AuditeMarlow/samples | `github:AuditeMarlow/samples` |
| AustinOliverHaskell/ms-teams-sounds-strudel | `github:AustinOliverHaskell/ms-teams-sounds-strudel` |
| bruveping/RepositorioDesonidosParaExperimentar02 | `github:bruveping/RepositorioDesonidosParaExperimentar02` |
| Bubobubobubobubo/Dough-Amen | `github:Bubobubobubobubo/Dough-Amen` |
| Bubobubobubobubo/Dough-Juj | `github:Bubobubobubobubo/Dough-Juj` |
| eddyflux/crate | `github:eddyflux/crate` |
| EloMorelo/samples | `github:EloMorelo/samples` |
| emrexdeger/strudelSamples | `github:emrexdeger/strudelSamples` |
| fjpolo/fjpolo-Strudel | `github:fjpolo/fjpolo-Strudel` |
| fstiffo/polifonia-samples | `github:fstiffo/polifonia-samples` |
| hvillase/cavlp-25p | `github:hvillase/cavlp-25p` |
| k09/samples | `github:k09/samples` |
| kaiye10/strudelSamples | `github:kaiye10/strudelSamples` |
| mot4i/garden | `github:mot4i/garden` |
| mysinglelise/msl-strudel-samples | `github:mysinglelise/msl-strudel-samples` |
| Nikeryms/Samples | `github:Nikeryms/Samples` |
| prismograph/departure | `github:prismograph/departure` |
| QuantumVillage/quantum-music | `github:QuantumVillage/quantum-music` |
| RikyBac15/samples | `github:RikyBac15/samples` |
| salsicha/capoeira_strudel | `github:salsicha/capoeira_strudel` |
| sonidosingapura/rochormatic | `github:sonidosingapura/rochormatic` |
| terrorhank/samples | `github:terrorhank/samples` |
| tesspilot/samples | `github:tesspilot/samples` |
| tidalcycles/Dirt-Samples | `github:tidalcycles/Dirt-Samples` (already loaded as `Dirt-Samples`) |
| TodePond/samples | `github:TodePond/samples` |
| TristanCacqueray/mirus | `github:TristanCacqueray/mirus` |
| Veikkosuhonen/graffathon25-demo | `github:Veikkosuhonen/graffathon25-demo` |
| wyan/livecoding-samples | `github:wyan/livecoding-samples` |
| yaxu/clean-breaks | `github:yaxu/clean-breaks` |

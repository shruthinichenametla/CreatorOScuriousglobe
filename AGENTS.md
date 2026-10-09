<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Browser only reads `public.scripts` (SELECT-only RLS); all writes happen server-side. Why: user requirement, keeps client untrusted.
- Script generation/review entry points live in `src/lib/api.ts`. Why: single seam to connect the backend later.

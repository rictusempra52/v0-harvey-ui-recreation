# Frontend Rules (校則)

## TypeScript
- **No Implicit Any**: `any` 型の使用は禁止です。常に適切な Interface や Type を定義して使用してください。
- **Strong Typing**: 関数、引数、戻り値には必ず型注釈を付けてください。

## React
- **Functional Components**: 全てのコンポーネントは関数コンポーネントとして実装してください。
- **Hooks Rules**: `useEffect`、`useState` などの Hooks はルールの則って正しく使用してください（条件付き呼び出し禁止など）。
- **Component Structure**: ロジックと表示を適切に分離し、読みやすい構造を維持してください。

## Styling (Tailwind CSS)
- **Utility First**: Tailwind CSS のユーティリティクラスを優先して使用してください。
- **No Inline Styles**: `style` 属性によるインラインスタイルは可能な限り避けてください。
- **Responsive Design**: モバイルファースト、またはデスクトップファーストで一貫したレスポンシブ対応を行ってください。

## Documentation (要件定義)
- **Per-Page Requirements**: ページを作成または大幅に改修する際は、必ずそのページの要件定義を行い、Markdownファイルとして適切な場所に保存してください（例: `docs/requirements/page-name.md`）。

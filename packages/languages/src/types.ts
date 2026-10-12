export interface LanguageInfo {
  name: string;
  displayName: string;
  extensions: string[];
  filenames: string[];
  mimeTypes: string[];
  category: 'programming' | 'markup' | 'scripting' | 'config' | 'data' | 'query';
  paradigms: ('imperative' | 'functional' | 'object-oriented' | 'procedural' | 'declarative' | 'concurrent')[];
  version: string;
  tooling: LanguageToolingInfo;
}

export interface LanguageToolingInfo {
  lsp?: string;
  formatter?: string;
  linter?: string;
  testRunner?: string;
  packageManager?: string;
  buildTool?: string;
  debugger?: string;
}

export interface DetectionResult {
  language: string;
  confidence: number;
  method: 'extension' | 'filename' | 'shebang' | 'content' | 'mixed';
  alternatives: { language: string; confidence: number }[];
}

export interface AnalysisResult {
  language: string;
  filePath: string;
  metrics?: CodeMetrics;
  issues?: CodeIssue[];
  structure?: CodeStructure;
  dependencies?: DependencyInfo[];
  symbols?: SymbolInfo[];
  complexity?: ComplexityInfo;
}

export interface CodeMetrics {
  linesOfCode: number;
  linesOfComments: number;
  blankLines: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  halsteadVolume: number;
  halsteadDifficulty: number;
  halsteadEffort: number;
}

export interface CodeIssue {
  type: 'error' | 'warning' | 'info' | 'hint';
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  message: string;
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  suggestion?: string;
  documentationUrl?: string;
}

export interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}

export interface FunctionInfo {
  name: string;
  line: number;
  endLine: number;
  parameters: ParameterInfo[];
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
  decorators: string[];
  complexity: number;
}

export interface ClassInfo {
  name: string;
  line: number;
  endLine: number;
  extends?: string;
  implements: string[];
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  decorators: string[];
}

export interface InterfaceInfo {
  name: string;
  line: number;
  endLine: number;
  extends: string[];
  properties: PropertyInfo[];
  methods: FunctionInfo[];
}

export interface TypeInfo {
  name: string;
  kind: 'type' | 'interface' | 'enum' | 'alias';
  line: number;
  definition: string;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
  decorators: string[];
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  line: number;
}

export interface ImportSpecifier {
  name: string;
  alias?: string;
  type: 'default' | 'named' | 'namespace' | 'side-effect';
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named' | 'namespace';
  line: number;
  declarationType: 'function' | 'class' | 'const' | 'type' | 'interface';
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  source: 'npm' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle' | 'composer' | 'nuget';
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'enum' | 'namespace';
  filePath: string;
  line: number;
  column: number;
  signature?: string;
  documentation?: string;
}

export interface ComplexityInfo {
  cyclomatic: number;
  cognitive: number;
  functions: { name: string; complexity: number }[];
  hotspots: { filePath: string; function: string; complexity: number }[];
}

export interface FormatResult {
  formatted: string;
  changed: boolean;
  language: string;
  optionsUsed: FormatOptions;
}

export interface FormatOptions {
  indentSize?: number;
  indentType?: 'spaces' | 'tabs';
  lineWidth?: number;
  singleQuote?: boolean;
  trailingComma?: 'none' | 'es5' | 'all';
  semi?: boolean;
  bracketSpacing?: boolean;
  parser?: string;
}

export interface LintResult {
  issues: CodeIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    hints: number;
  };
  language: string;
  configUsed: string;
}

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  suites: TestSuite[];
  coverage?: CoverageInfo;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  duration: number;
}

export interface TestCase {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  filePath?: string;
  line?: number;
}

export interface CoverageInfo {
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}
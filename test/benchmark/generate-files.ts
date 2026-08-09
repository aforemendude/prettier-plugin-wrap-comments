import type { BuiltInParserName } from 'prettier';

export type BenchmarkFile = {
  name: string;
  parser: BuiltInParserName;
  source: string;
};

const sectionCount = 100;

export function generateBenchmarkFiles(): BenchmarkFile[] {
  return [
    {
      name: 'comment-free JavaScript',
      parser: 'babel',
      source: generateJavaScript(),
    },
    {
      name: 'comment-heavy TypeScript',
      parser: 'typescript',
      source: generateTypeScript(),
    },
    {
      name: 'JSX-comment-heavy TSX',
      parser: 'typescript',
      source: generateTsx(),
    },
  ];
}

function generateJavaScript(): string {
  const lines = ['export const generatedValues=[];'];

  for (let index = 0; index < sectionCount; index += 1) {
    lines.push(
      `export function calculate${index}(items,multiplier){`,
      `const weighted=items.map((item,itemIndex)=>({itemIndex,value:item*multiplier+${index}}));`,
      'const evenValues=weighted.filter(({value})=>value%2===0);',
      'return evenValues.reduce((total,{value})=>total+value,0);',
      '}',
      `generatedValues.push(calculate${index}([1,2,3,4,5],${index + 1}));`,
    );
  }

  lines.push('');

  return lines.join('\n');
}

function generateTypeScript(): string {
  const lines = ['export type GeneratedSummary={name:string;total:number;values:readonly number[]};', ''];

  for (let index = 0; index < sectionCount; index += 1) {
    lines.push(
      `// Calculate generated summary ${index} from every supplied value while retaining enough descriptive prose to exercise Markdown comment wrapping.`,
      `export function summarize${index}(items:readonly number[],multiplier:number):GeneratedSummary{`,
      `const values=items.map((item,itemIndex)=>item*multiplier+itemIndex+${index}); // Keep the generated values in input order so benchmark runs exercise trailing comment layout and wrapping.`,
      `/* This generated block comment describes the reduction for section ${index} and contains enough words to wrap across multiple output lines. */`,
      'const total=values.reduce((sum,value)=>sum+value,0);',
      `return{name:'summary-${index}',total,values};`,
      '}',
      '',
    );
  }

  return lines.join('\n');
}

function generateTsx(): string {
  const lines = [
    "import type {ReactNode} from 'react';",
    'type GeneratedCardProps={items:readonly string[];title:ReactNode};',
    '',
  ];

  for (let index = 0; index < sectionCount; index += 1) {
    lines.push(
      `export function GeneratedCard${index}({items,title}:GeneratedCardProps){`,
      `return <section data-generated-card={${index}}>`,
      '<h2>{title}</h2>',
      `{/* This generated JSX comment documents card ${index} with enough prose to exercise multiline block comment rewriting. */}`,
      '<ul>',
      `{items.map((item,itemIndex)=><li key={itemIndex}>{item}{/* This generated trailing JSX comment exercises expression layout. */}</li>)}`,
      '</ul>',
      '</section>;',
      '}',
      '',
    );
  }

  return lines.join('\n');
}

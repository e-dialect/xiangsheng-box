import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-dom';
import { describe, expect, it } from 'vitest';

describe('AppShell brand copy', () => {
  it('shows the product name without an unexplained English subtitle', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/AppShell.vue'), 'utf8');
    const template = source.match(/<template>([\s\S]*?)<\/template>/)[1];
    const ast = parse(template);
    const findBrand = (node) => {
      if (node.props?.some((prop) => prop.name === 'class'
        && prop.value?.content === 'app-shell__brand')) return node;
      return node.children?.map(findBrand).find(Boolean);
    };
    const brand = findBrand(ast);
    expect(brand.children.map((node) => node.content || '').join('').trim()).toBe('乡声集盒');
    expect(template).not.toMatch(/FIELD\s+ARCHIVE/i);
  });
});

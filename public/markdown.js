/**
 * 一个克制的小型 Markdown 渲染器。
 *
 * 只支持聊天里常见的块级语法：标题、段落、列表、引用、表格、分割线、代码块。
 * 所有原文先转义，再进行格式化；链接只允许 http/https。
 * 不渲染原始 HTML，也不加载远程图片（图片语法会降级成链接）。
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function safeUrl(raw) {
  const url = String(raw ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  if (/[\u0000-\u001f\u007f"'<>]/.test(url)) return null;
  return url;
}

function renderInline(raw) {
  const stash = [];
  const hold = (html) => `\u0000${stash.push(html) - 1}\u0000`;
  let text = String(raw ?? '');

  // 行内代码先取走，避免被后面的强调语法改写。
  text = text.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));

  // 图片不直接加载，降级成链接，避免远程追踪与布局跳动。
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, url) => {
    const safe = safeUrl(url);
    if (!safe) return `![${alt}](${url})`;
    return hold(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(alt || '图片')}</a>`);
  });

  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return `[${label}](${url})`;
    return hold(`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
  });

  text = escapeHtml(text);

  // 裸链接：转义后 & 变成 &amp;，放回 href 前解一次。
  text = text.replace(/(^|[\s(（])(https?:\/\/[^\s<\u0000]+)/g, (_, prefix, url) => {
    const trimmed = url.replace(/[.,;:!?，。；：！？、]+$/, '');
    const trailing = url.slice(trimmed.length);
    if (!trimmed) return prefix + url;
    const display = trimmed.replace(/&amp;/g, '&');
    return prefix + hold(`<a href="${escapeHtml(display)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`) + trailing;
  });

  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)] ?? '');
}

function splitRow(line) {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line) {
  if (!line || !line.includes('-')) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function codeBlock(code, lang) {
  const label = lang || 'text';
  return `<div class="code-block"><div class="code-head"><span>${escapeHtml(label)}</span><button class="copy-code" type="button">复制</button></div><pre><code>${escapeHtml(code)}</code></pre></div>`;
}

function isBlockStart(lines, index) {
  const line = lines[index];
  if (/^\s*(`{3,}|~{3,})/.test(line)) return true;
  if (/^(#{1,6})\s+/.test(line)) return true;
  if (/^\s*>\s?/.test(line)) return true;
  if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) return true;
  if (/^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line)) return true;
  if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) return true;
  return false;
}

function consumeList(lines, start) {
  const items = [];
  let index = start;
  let baseIndent = null;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) break;

    const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (match) {
      const indent = match[1].replace(/\t/g, '  ').length;
      if (baseIndent === null) baseIndent = indent;
      const depth = Math.min(2, Math.max(0, Math.floor((indent - baseIndent) / 2)));
      items.push({ depth, ordered: /^\d/.test(match[2]), text: match[3] });
      index += 1;
    } else if (/^\s{2,}\S/.test(line) && items.length > 0) {
      items[items.length - 1].text += `\n${line.trim()}`;
      index += 1;
    } else {
      break;
    }
  }

  const build = (from, depth) => {
    const ordered = items[from]?.ordered ?? false;
    let html = ordered ? '<ol>' : '<ul>';
    let cursor = from;

    while (cursor < items.length) {
      const item = items[cursor];
      if (item.depth < depth) break;
      if (item.depth > depth) break;

      html += `<li>${renderInline(item.text).replace(/\n/g, '<br>')}`;
      cursor += 1;

      if (cursor < items.length && items[cursor].depth > depth) {
        const nested = build(cursor, items[cursor].depth);
        html += nested.html;
        cursor = nested.next;
      }

      html += '</li>';
    }

    html += ordered ? '</ol>' : '</ul>';
    return { html, next: cursor };
  };

  const rootDepth = items[0]?.depth ?? 0;
  const tree = build(0, rootDepth);

  return {
    html: tree.html,
    next: index,
  };
}

export function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const length = fence[1].length;
      const language = fence[2] || 'text';
      const body = [];
      index += 1;
      const closeRe = new RegExp(`^\\s*${marker}{${length},}\\s*$`);
      while (index < lines.length && !closeRe.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(codeBlock(body.join('\n'), language));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      output.push('<hr>');
      index += 1;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = splitRow(line);
      const align = splitRow(lines[index + 1]).map((cell) => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        if (cell.startsWith(':')) return 'left';
        return '';
      });
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }

      const head = header.map((cell, column) => {
        const className = align[column] ? ` class="align-${align[column]}"` : '';
        return `<th${className}>${renderInline(cell)}</th>`;
      }).join('');

      const body = rows.map((row) => {
        const cells = header.map((_, column) => {
          const className = align[column] ? ` class="align-${align[column]}"` : '';
          return `<td${className}>${renderInline(row[column] ?? '')}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      output.push(`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      output.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const list = consumeList(lines, index);
      output.push(list.html);
      index = list.next;
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }

    if (paragraph.length === 0) {
      index += 1;
      continue;
    }

    output.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`);
  }

  return output.join('\n');
}

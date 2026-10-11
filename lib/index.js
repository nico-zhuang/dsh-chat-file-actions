import z from '@deepseek-ai/schemastery';

// DSH's settings service owns profile persistence and live Config revisions.
// This Host half adds no routes, native commands, or independent file writes.
export const Config = z.object({
  openMode: z.union([z.const('system'), z.const('sidebar')]).default('system').volatile(),
  copyActions: z.array(z.union([z.const('path'), z.const('name'), z.const('markdown')]))
    .default(['path', 'name', 'markdown']).volatile()
});

export function apply() {}

import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
    resolve: {
        alias: {
            // Mesmo apelido do tsconfig, para os testes importarem os módulos do app.
            '@': path.resolve(process.cwd(), '.'),
            // `server-only` só existe sob a condição `react-server`; nos testes
            // vira um módulo neutro.
            'server-only': path.resolve(process.cwd(), 'tests/stubs/server-only.ts')
        }
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts']
    }
})

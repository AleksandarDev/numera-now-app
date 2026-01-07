import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';

interface ComponentInfo {
    path: string;
    name: string;
    isUsed: boolean;
}

const COMPONENT_EXTENSIONS = ['.tsx', '.jsx'];
const EXCLUDE_DIRS = ['node_modules', '.next', 'dist', 'build', '.git', 'drizzle'];
const EXCLUDE_FILES = ['layout.tsx', 'page.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx', 'globals.css'];

function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = readdirSync(dir);

    files.forEach(file => {
        const filePath = join(dir, file);
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                getAllFiles(filePath, fileList);
            }
        } else {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function isComponentFile(filePath: string): boolean {
    const ext = extname(filePath);
    const fileName = basename(filePath);

    // Exclude Next.js special files
    if (EXCLUDE_FILES.includes(fileName)) {
        return false;
    }

    return COMPONENT_EXTENSIONS.includes(ext);
}

function getNameCandidates(filePath: string): string[] {
    const fileName = basename(filePath, extname(filePath));
    const parts = fileName.split(/[-_]/).filter(Boolean);

    const pascal = parts
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

    const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);

    return Array.from(new Set([pascal, camel, fileName]));
}

function isComponentUsed(componentPath: string, nameCandidates: string[], allFiles: string[]): boolean {
    const componentFileName = basename(componentPath);
    const componentFileNameNoExt = basename(componentPath, extname(componentPath));

    for (const file of allFiles) {
        // Skip the component file itself
        if (file === componentPath) {
            continue;
        }

        // Only check in relevant files
        const ext = extname(file);
        if (!['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
            continue;
        }

        try {
            const content = readFileSync(file, 'utf-8');

            const pathOnlyPattern = new RegExp(`(?:import|export)\\s+[^;]*['"][^'"]*${componentFileNameNoExt}['"]`);

            if (pathOnlyPattern.test(content)) {
                return true;
            }

            for (const candidate of nameCandidates) {
                const importPatterns = [
                    new RegExp(`import\\s*{[^}]*\\b${candidate}\\b[^}]*}\\s*from\\s*['"][^'"]*${componentFileNameNoExt}['"]`),
                    new RegExp(`import\\s+${candidate}\\s+from\\s*['"][^'"]*${componentFileNameNoExt}['"]`),
                    new RegExp(`export\\s*{[^}]*\\b${candidate}\\b[^}]*}\\s*from\\s*['"][^'"]*${componentFileNameNoExt}['"]`),
                ];

                for (const pattern of importPatterns) {
                    if (pattern.test(content)) {
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error(`Error reading file ${file}:`, error);
        }
    }

    return false;
}

function main() {
    console.log('🔍 Checking for unused components...\n');

    const currentDir = fileURLToPath(new URL('.', import.meta.url));
    const projectRoot = join(currentDir, '..');
    const allFiles = getAllFiles(projectRoot);

    const componentFiles = allFiles.filter(isComponentFile);
    const unusedComponents: ComponentInfo[] = [];
    const usedComponents: ComponentInfo[] = [];

    console.log(`Found ${componentFiles.length} component files to check.\n`);

    for (const componentPath of componentFiles) {
        const nameCandidates = getNameCandidates(componentPath);
        const relativePath = relative(projectRoot, componentPath);
        const isUsed = isComponentUsed(componentPath, nameCandidates, allFiles);

        const info: ComponentInfo = {
            path: relativePath,
            name: nameCandidates[0],
            isUsed,
        };

        if (isUsed) {
            usedComponents.push(info);
        } else {
            unusedComponents.push(info);
        }
    }

    if (unusedComponents.length === 0) {
        console.log('✅ No unused components found! All components are being used.');
    } else {
        console.log(`⚠️  Found ${unusedComponents.length} potentially unused component(s):\n`);

        unusedComponents.forEach(component => {
            console.log(`  - ${component.path}`);
        });

        console.log('\n💡 Note: This is a basic check. Components might be:');
        console.log('   - Used dynamically');
        console.log('   - Imported with aliases');
        console.log('   - Re-exported through barrel files (index.ts)');
        console.log('   - Used in ways not detected by this script');
        console.log('\n   Please verify before deleting!');
    }

    console.log(`\n📊 Summary: ${usedComponents.length} used, ${unusedComponents.length} potentially unused`);
}

main();

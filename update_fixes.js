const fs = require('fs');
let content = fs.readFileSync('PENDING_FIXES.md', 'utf-8');

const tableRow = '| **FIX-09** | Remove Admin Password Prompt for Demoted Admins | P1 (High) | `[ ] OPEN` |\n| **FIX-10** | Admin Dashboard Premium UI/UX Overhaul | P2 (Medium) | `[ ] OPEN` |';

content = content.replace(/\|\s*\*\*FIX-08\*\*\s*\|[^|]+\|\s*P0 \(Critical\)\s*\|\s*\`\[x\] CLOSED\`\s*\|/, match => match + '\n' + tableRow);

const newPrompts = `
---

### FIX-09: Remove Admin Password Prompt for Demoted Admins
- **Problem:** If a user is given an admin role, a \`PasswordHash\` is generated. When the admin role is later removed via the admin dashboard (\`ManageUser\` endpoint), the \`UserRole\` is deleted, but the \`PasswordHash\` remains. This can cause authentication confusion where the user might still be asked for an admin password on login.
- **Goal:** Ensure \`PasswordHash\` is explicitly cleared (\`null\`) when the \`ADMIN\` role is removed from a user.
- **Execution Prompt:**
  \`\`\`text
  Fix the demoted admin password prompt bug:
  1. In \`backend/SuperApp.API/Controllers/AdminController.cs\`, locate the \`REMOVE_ROLE\` action inside \`ManageUser\`.
  2. If the role being removed is \`ADMIN\` (check \`role.Name == RoleNames.Admin\`), explicitly set \`user.PasswordHash = null;\`.
  3. Verify \`AuthController.cs\` logic safely ignores users without the admin role.
  4. Run \`dotnet test\` to verify no regressions.
  \`\`\`

---

### FIX-10: Admin Dashboard Premium UI/UX Overhaul
- **Problem:** While basic mobile responsiveness was added (FIX-06), the admin dashboard still lacks a premium, polished professional aesthetic. The design feels basic, components lack proper elevation/shadows, and color contrast needs improvement for a modern web app.
- **Goal:** Perform a premium UI/UX overhaul of the admin portal (\`backend/SuperApp.API/wwwroot/admin/\`).
- **Execution Prompt:**
  \`\`\`text
  Implement a premium UI/UX overhaul for the Admin Dashboard:
  1. Edit \`backend/SuperApp.API/wwwroot/admin/index.html\` and associated CSS.
  2. Upgrade the typography hierarchy, spacing, and grid layouts.
  3. Implement modern glassmorphism or sleek dark-mode cards with refined box-shadows.
  4. Improve data tables with better padding, sticky headers, and alternating row colors.
  5. Add subtle CSS transitions/animations for hover states and modal dialogs.
  6. Ensure all inputs, buttons, and badges have a cohesive, premium brand language.
  \`\`\`
`;

content = content + newPrompts;
fs.writeFileSync('PENDING_FIXES.md', content);

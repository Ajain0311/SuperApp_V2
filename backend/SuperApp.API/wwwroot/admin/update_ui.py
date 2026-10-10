import sys

file_path = r'D:\Projects\SuperApp_V2\backend\SuperApp.API\wwwroot\admin\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update :root to modern glassmorphism and fix margins
content = content.replace('''        :root {
            --bg: #0A0E21;
            --surface: #141829;
            --surface-light: #1C2039;
            --border: #2A2D3E;
            --primary: #FF6B35;
            --primary-dark: #E55A2B;
            --secondary: #00C853;
            --text-primary: #FFFFFF;
            --text-secondary: #8E8E93;
            --text-tertiary: #6C6C70;
            --blue: #2196F3;
            --yellow: #FFD740;
            --red: #FF5252;
            --purple: #7C4DFF;
        }''', '''        :root {
            --bg: #0b0f19;
            --surface: rgba(20, 24, 41, 0.65);
            --surface-light: rgba(28, 32, 57, 0.75);
            --border: rgba(255, 255, 255, 0.08);
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #10b981;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-tertiary: #64748b;
            --blue: #3b82f6;
            --yellow: #f59e0b;
            --red: #ef4444;
            --purple: #8b5cf6;
            --backdrop-blur: blur(16px);
        }
        
        .card, .sidebar, .topbar, .modal {
            backdrop-filter: var(--backdrop-blur);
        }
        
        .role-checkbox {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: var(--surface-light);
            border: 1px solid var(--border);
            border-radius: 10px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            transition: all 0.2s;
        }
        .role-checkbox:hover {
            border-color: var(--primary);
            background: rgba(99, 102, 241, 0.1);
        }
        .role-checkbox input {
            accent-color: var(--primary);
            width: 16px;
            height: 16px;
        }
        
        .btn {
            border-radius: 10px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
''')

# Fix margins in content-area and card
content = content.replace('''        .content-area {
            padding: 32px;
            display: flex;
            flex-direction: column;
            gap: 28px;
        }''', '''        .content-area {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }''')

content = content.replace('''        .card {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }''', '''        .card {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }''')

# 2. Update users tab HTML
users_tab_old = '''            <!-- TAB 2: USERS -->
            <section id="tab-users" style="display: none;">
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">User Accounts & RBAC</h2>
                        <input type="text" class="search-box" placeholder="Search mobile, name, or user id" id="userSearchInput" oninput="fetchUsers()">
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Name</th>
                                    <th>Mobile Number</th>
                                    <th>Roles</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody">
                                <tr>
                                    <td>#1</td>
                                    <td>Super Admin</td>
                                    <td>9999999999</td>
                                    <td><span class="badge badge-verified">ADMIN</span> <span class="badge badge-role">CUSTOMER</span></td>
                                    <td><span class="badge badge-active">ACTIVE</span></td>
                                    <td>-</td>
                                </tr>
                                <tr>
                                    <td>#2</td>
                                    <td>Meghana Foods Owner</td>
                                    <td>9876543210</td>
                                    <td><span class="badge" style="background: rgba(255, 107, 53, 0.2); color: var(--primary);">RESTAURANT_OWNER</span></td>
                                    <td><span class="badge badge-active">ACTIVE</span></td>
                                    <td><button class="btn btn-secondary btn-sm" onclick="toggleUserStatus(2)">Suspend</button></td>
                                </tr>
                                <tr>
                                    <td>#3</td>
                                    <td>Rajesh Kumar (Driver)</td>
                                    <td>9845112233</td>
                                    <td><span class="badge" style="background: rgba(0, 200, 83, 0.2); color: var(--secondary);">DRIVER</span></td>
                                    <td><span class="badge badge-active">ACTIVE</span></td>
                                    <td><button class="btn btn-secondary btn-sm" onclick="toggleUserStatus(3)">Suspend</button></td>
                                </tr>
                                <tr>
                                    <td>#4</td>
                                    <td>Aditya Sharma</td>
                                    <td>9988776655</td>
                                    <td><span class="badge badge-role">CUSTOMER</span> <span class="badge" style="background: rgba(124, 77, 255, 0.2); color: var(--purple);">MARKETPLACE_SELLER</span></td>
                                    <td><span class="badge badge-active">ACTIVE</span></td>
                                    <td><button class="btn btn-secondary btn-sm" onclick="toggleUserStatus(4)">Suspend</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>'''

users_tab_new = '''            <!-- TAB 2: USERS -->
            <section id="tab-users" style="display: none;">
                <div class="card" style="background: transparent; border: none; padding: 0; box-shadow: none; backdrop-filter: none;">
                    <div class="card-header" style="background: var(--surface); padding: 20px; border-radius: 16px; margin-bottom: 24px; backdrop-filter: var(--backdrop-blur); border: 1px solid var(--border);">
                        <h2 class="card-title">User Accounts & RBAC</h2>
                        <input type="text" class="search-box" placeholder="Search mobile, name, or user id" id="userSearchInput" oninput="fetchUsers()" style="width: 100%; max-width: 320px;">
                    </div>
                    <div id="usersGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                        <!-- Cards will be injected here -->
                    </div>
                </div>
            </section>'''
content = content.replace(users_tab_old, users_tab_new)

# 3. Update assignModal HTML
assign_modal_old = '''    <div class="modal-backdrop" id="assignModal">
        <div class="modal" style="max-width: 520px;">
            <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">Assign roles</h3>
            <p id="assignUserLabel" style="margin-bottom: 12px;"></p>
            <input type="hidden" id="assignUserId">
            <label><input type="checkbox" id="roleCustomer" checked disabled> Customer (kept)</label><br>
            <label><input type="checkbox" id="roleOwner"> Restaurant owner</label><br>
            <label><input type="checkbox" id="roleDriver"> Captain</label><br>
            <label><input type="checkbox" id="roleSeller"> Bazaar seller</label><br>
            <label><input type="checkbox" id="roleAdmin"> Admin</label>
            <div class="form-group" style="margin-top: 12px;">
                <label>Restaurant name</label>
                <input class="form-input" id="assignRestName">
            </div>
            <div class="form-group"><label>Address</label><input class="form-input" id="assignAddress"></div>
            <div class="form-group"><label>City</label><input class="form-input" id="assignCity"></div>
            <div class="form-group"><label>Contact</label><input class="form-input" id="assignPhone"></div>
            <div class="form-group"><label>Cuisine</label><input class="form-input" id="assignCuisine"></div>
            <div class="form-group"><label>License</label><input class="form-input" id="assignLicense"></div>
            <div class="form-group">
                <label>Vehicle</label>
                <select class="form-input" id="assignVehicle">
                    <option value="BIKE">BIKE</option>
                    <option value="AUTO">AUTO</option>
                    <option value="CAB">CAB</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="closeAssignUser()">Cancel</button>
                <button class="btn btn-primary" onclick="submitAssignUser()">Save</button>
            </div>
        </div>
    </div>'''

assign_modal_new = '''    <div class="modal-backdrop" id="assignModal">
        <div class="modal" style="max-width: 600px; padding: 32px;">
            <h3 style="font-size: 22px; font-weight: 800; margin-bottom: 4px; color: var(--text-primary);">Manage User Roles</h3>
            <p id="assignUserLabel" style="margin-bottom: 24px; font-size: 14px; color: var(--text-secondary);"></p>
            <input type="hidden" id="assignUserId">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px;">
                <label class="role-checkbox"><input type="checkbox" id="roleCustomer" checked disabled> Customer</label>
                <label class="role-checkbox"><input type="checkbox" id="roleOwner"> Restaurant Owner</label>
                <label class="role-checkbox"><input type="checkbox" id="roleDriver"> Captain</label>
                <label class="role-checkbox"><input type="checkbox" id="roleSeller"> Bazaar Seller</label>
                <label class="role-checkbox"><input type="checkbox" id="roleAdmin"> Admin</label>
            </div>

            <div style="padding-top: 24px; border-top: 1px solid var(--border);">
                <h4 style="font-size: 15px; color: var(--text-primary); margin-bottom: 16px;">Role Specific Details</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group"><label>Restaurant Name</label><input class="form-input" id="assignRestName" placeholder="e.g. Meghana Foods"></div>
                    <div class="form-group"><label>Cuisine</label><input class="form-input" id="assignCuisine" placeholder="e.g. Biryani"></div>
                    <div class="form-group" style="grid-column: 1 / -1;"><label>Full Address</label><input class="form-input" id="assignAddress" placeholder="Street, Area, Landmark"></div>
                    <div class="form-group"><label>City</label><input class="form-input" id="assignCity" placeholder="e.g. Bengaluru"></div>
                    <div class="form-group"><label>Business Contact</label><input class="form-input" id="assignPhone" placeholder="10-digit number"></div>
                    <div class="form-group"><label>Driving License</label><input class="form-input" id="assignLicense" placeholder="DL Number"></div>
                    <div class="form-group">
                        <label>Vehicle Type</label>
                        <select class="form-input" id="assignVehicle">
                            <option value="BIKE">Bike</option>
                            <option value="AUTO">Auto Rickshaw</option>
                            <option value="CAB">Cab / Car</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
                <button class="btn btn-secondary" style="padding: 12px 24px;" onclick="closeAssignUser()">Cancel</button>
                <button class="btn btn-primary" style="padding: 12px 24px;" onclick="submitAssignUser()">Save Changes</button>
            </div>
        </div>
    </div>'''
content = content.replace(assign_modal_old, assign_modal_new)

# 4. Update fetchUsers function
fetch_users_old = '''        async function fetchUsers() {
            try {
                const term = document.getElementById('userSearchInput')?.value?.trim() || '';
                const res = await fetch('/api/admin/users?search=' + encodeURIComponent(term));
                if (res.ok) {
                    const json = await res.json();
                    const users = json.data?.items || json.data || [];
                    if (Array.isArray(users) && users.length > 0) {
                        const tbody = document.getElementById('usersTableBody');
                        tbody.innerHTML = users.map(u => `
                            <tr>
                                <td>#${u.id}</td>
                                <td><strong>${u.fullName || 'User'}</strong></td>
                                <td>${u.mobileNumber}</td>
                                <td>${(u.roles || ['CUSTOMER']).map(r => `<span class="badge ${r === 'ADMIN' ? 'badge-verified' : 'badge-role'}">${r}</span>`).join(' ')}</td>
                                <td><span class="badge ${u.isActive ? 'badge-active' : ''}">${u.isActive ? 'ACTIVE' : 'SUSPENDED'}</span></td>
                                <td>
                                    <button class="btn btn-secondary btn-sm" onclick="openAssignUser(${u.id}, '${(u.fullName || '').replace(/'/g, '')}', '${u.mobileNumber}')">Manage</button>
                                    <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus(${u.id}, ${u.isActive})">
                                        ${u.isActive ? 'Suspend' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        `).join('');
                    }
                }
            } catch (err) {
                console.log('Error fetching users', err);
            }
        }'''

fetch_users_new = '''        async function fetchUsers() {
            try {
                const term = document.getElementById('userSearchInput')?.value?.trim() || '';
                const res = await fetch('/api/admin/users?search=' + encodeURIComponent(term));
                if (res.ok) {
                    const json = await res.json();
                    const users = json.data?.items || json.data || [];
                    const grid = document.getElementById('usersGrid');
                    if (grid) {
                        if (Array.isArray(users) && users.length > 0) {
                            grid.innerHTML = users.map(u => `
                                <div class="card" style="padding: 20px; transition: transform 0.2s; cursor: default;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                        <div>
                                            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${u.fullName || 'User'} <span style="font-size: 12px; color: var(--text-tertiary); font-weight: 500;">#${u.id}</span></div>
                                            <div style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">📞 ${u.mobileNumber}</div>
                                        </div>
                                        <span class="badge ${u.isActive ? 'badge-active' : 'badge-suspended'}" style="font-size: 10px;">${u.isActive ? 'ACTIVE' : 'SUSPENDED'}</span>
                                    </div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;">
                                        ${(u.roles || ['CUSTOMER']).map(r => `<span class="badge ${r === 'ADMIN' ? 'badge-verified' : 'badge-role'}" style="font-size: 10px;">${r}</span>`).join('')}
                                    </div>
                                    <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border);">
                                        <button class="btn btn-primary btn-sm" style="flex: 1; justify-content: center; padding: 8px;" onclick="openAssignUser(${u.id}, '${(u.fullName || '').replace(/'/g, '')}', '${u.mobileNumber}')">Manage Roles</button>
                                        <button class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center; padding: 8px;" onclick="toggleUserStatus(${u.id}, ${u.isActive})">
                                            ${u.isActive ? 'Suspend' : 'Activate'}
                                        </button>
                                    </div>
                                </div>
                            `).join('');
                        } else {
                            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-secondary);">No users found matching your search.</div>';
                        }
                    }
                }
            } catch (err) {
                console.log('Error fetching users', err);
            }
        }'''
content = content.replace(fetch_users_old, fetch_users_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement Complete.")

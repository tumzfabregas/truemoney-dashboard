import React, { createContext, useContext, useState, PropsWithChildren } from 'react';

type Language = 'th' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  th: {
    // General
    "dashboard_title": "TrueMoney Dashboard",
    "dashboard_subtitle": "ตรวจสอบรายการเงินเข้าแบบเรียลไทม์",
    "source": "แหล่งข้อมูล",
    "mock": "จำลอง",
    "live": "API จริง",
    "auto_on": "ออโต้ เปิด",
    "auto_off": "ออโต้ ปิด",
    "refresh": "รีเฟรช",
    "clear": "ล้างค่า",
    "save": "บันทึก",
    "cancel": "ยกเลิก",
    "copy": "คัดลอก",
    
    // Search & Export
    "search_placeholder": "ค้นหาเบอร์โทร, ข้อความ หรือจำนวนเงิน...",
    "search": "ค้นหา",
    "export_csv": "ส่งออก CSV",
    "summary_today": "ยอดรวมวันนี้",
    "time_range_today": "(00:00 - 23:59)",
    "summary_month": "ยอดรวมเดือนนี้",
    "total_amount": "ยอดเงินรวม",
    "tx_count": "จำนวนรายการ",
    "filtered_count": "รายการที่พบ",
    
    // Table
    "sender": "ผู้โอน",
    "amount": "จำนวนเงิน",
    "date": "วันที่",
    "message": "ข้อความ",
    "showing": "แสดง",
    "to": "ถึง",
    "of": "จาก",
    "entries": "รายการ",
    "page": "หน้า",
    "no_transactions": "ไม่พบรายการ",
    "waiting_webhook": "กำลังรอข้อมูล...",

    // Tabs
    "tab_dashboard": "แดชบอร์ด",
    "tab_services": "บริการ",
    "tab_users": "ผู้ใช้งาน",
    "tab_code": "โค้ด API",

    // Admin Tools
    "config_sim": "ตั้งค่า & จำลองข้อมูล",
    "simulator": "จำลองรายการเงินเข้า",
    "simulate_btn": "จำลองเงินเข้า (สุ่ม)",
    "simulate_desc": "สร้างรายการสุ่มและส่งไปยัง",
    "setup_info": "ข้อมูลการติดตั้ง",
    "db_status": "สถานะฐานข้อมูล",
    "verification_secret": "รหัสยืนยัน (Secret)",
    "verification_placeholder": "วางรหัสจากแอป TrueMoney (902b...)",
    "verified": "เชื่อมต่อเรียบร้อย (Verified)",
    "service_token": "TrueMoney Service Token",
    "service_token_placeholder": "วาง Token สำหรับเช็คยอดเงิน (2293d...)",
    "wallet_balance": "ยอดคงเหลือ",
    
    // Advanced Tools
    "advanced_tools": "เครื่องมือขั้นสูง",
    "payload_tester": "ทดสอบ Payload / Token",
    "payload_placeholder": "วาง JSON หรือ JWT Token ที่นี่...",
    "send_payload": "ส่งข้อมูล",
    "ai_analysis": "วิเคราะห์ด้วย Gemini AI",
    "analyze_btn": "วิเคราะห์ทันที",
    "thinking": "กำลังคิด...",

    // Services
    "svc_incoming": "รายการรับเงิน",
    "svc_incoming_desc": "แจ้งเตือนรายการ P2P เรียลไทม์",
    "svc_outgoing": "แจ้งเตือนรายจ่าย",
    "svc_outgoing_desc": "แจ้งเตือนการจ่ายบิลและค่าใช้จ่าย",
    "svc_balance": "เช็คยอดเงิน",
    "svc_balance_desc": "ดูยอดเงินคงเหลือในกระเป๋า",
    "svc_last_tx": "รายการล่าสุด",
    "svc_last_tx_desc": "ดึงข้อมูลรายการล่าสุด",
    "active": "ใช้งาน",
    "soon": "เร็วๆ นี้",
    "demo": "ตัวอย่าง",
    "api": "API",

    // User Management
    "user_management": "จัดการผู้ใช้งาน",
    "add_user": "เพิ่มผู้ใช้",
    "edit_user": "แก้ไขผู้ใช้",
    "new_user": "ผู้ใช้ใหม่",
    "username": "ชื่อผู้ใช้",
    "password": "รหัสผ่าน",
    "role": "สิทธิ์",
    "role_dev": "Developer",
    "role_admin": "Admin (ผู้จัดการ)",
    "role_staff": "Staff (พนักงาน)",
    "save_user": "บันทึกผู้ใช้",
    
    // Login
    "app_name": "TrueMoney Dashboard",
    "signin_btn": "เข้าสู่ระบบ",
    "secure_connection": "เชื่อมต่อผ่านระบบความปลอดภัย",
    "login_error_empty": "กรุณากรอกข้อมูลให้ครบถ้วน",
    "login_error_invalid": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    "change_password": "เปลี่ยนรหัสผ่าน",
    "new_password": "รหัสผ่านใหม่",
    "logout": "ออกจากระบบ",
    "confirm_logout": "คุณต้องการออกจากระบบหรือไม่?",
    "password_changed": "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว",
  },
  en: {
    // General
    "dashboard_title": "TrueMoney Dashboard",
    "dashboard_subtitle": "Monitor your incoming transactions in real-time.",
    "source": "Source",
    "mock": "Mock",
    "live": "Live API",
    "auto_on": "Auto On",
    "auto_off": "Auto Off",
    "refresh": "Refresh",
    "clear": "Clear",
    "save": "Save",
    "cancel": "Cancel",
    "copy": "Copy",

    // Search & Export
    "search_placeholder": "Search phone, message or amount...",
    "search": "Search",
    "export_csv": "Export CSV",
    "summary_today": "Daily Total",
    "time_range_today": "(00:00 - 23:59)",
    "summary_month": "Monthly Total",
    "total_amount": "Total Amount",
    "tx_count": "Transactions",
    "filtered_count": "Items Found",

    // Table
    "sender": "Sender",
    "amount": "Amount",
    "date": "Date",
    "message": "Message",
    "showing": "Showing",
    "to": "to",
    "of": "of",
    "entries": "entries",
    "page": "Page",
    "no_transactions": "No transactions found",
    "waiting_webhook": "Waiting for data...",

    // Tabs
    "tab_dashboard": "Dashboard",
    "tab_services": "Services",
    "tab_users": "Users",
    "tab_code": "API Code",

    // Admin Tools
    "config_sim": "Configuration & Simulation",
    "simulator": "Transaction Simulator",
    "simulate_btn": "Simulate Incoming Money",
    "simulate_desc": "Generates a random transaction and sends it to the",
    "setup_info": "Setup Information",
    "db_status": "Database Status",
    "verification_secret": "Verification Secret",
    "verification_placeholder": "Paste code from TrueMoney app (902b...)",
    "verified": "Connection Verified",
    "service_token": "TrueMoney Service Token",
    "service_token_placeholder": "Paste balance checking token (2293d...)",
    "wallet_balance": "Wallet Balance",

    // Advanced Tools
    "advanced_tools": "Advanced Tools",
    "payload_tester": "Payload / Token Tester",
    "payload_placeholder": "Paste JSON or JWT Token here...",
    "send_payload": "Send Payload",
    "ai_analysis": "Gemini AI Analysis",
    "analyze_btn": "Analyze Now",
    "thinking": "Thinking...",

    // Services
    "svc_incoming": "Incoming Transactions",
    "svc_incoming_desc": "Real-time P2P transaction alerts",
    "svc_outgoing": "Outgoing Notify",
    "svc_outgoing_desc": "Expense & Bill Payment alerts",
    "svc_balance": "Check Balance",
    "svc_balance_desc": "View current wallet balance",
    "svc_last_tx": "Last Transaction",
    "svc_last_tx_desc": "Fetch the most recent item",
    "active": "Active",
    "soon": "Soon",
    "demo": "Demo",
    "api": "API",

    // User Management
    "user_management": "User Management",
    "add_user": "Add User",
    "edit_user": "Edit User",
    "new_user": "New User",
    "username": "Username",
    "password": "Password",
    "role": "Role",
    "role_dev": "Developer",
    "role_admin": "Admin",
    "role_staff": "Staff",
    "save_user": "Save User",

    // Login
    "app_name": "TrueMoney Dashboard",
    "signin_btn": "Sign In",
    "secure_connection": "Protected by secure connection",
    "login_error_empty": "Please fill in all fields",
    "login_error_invalid": "Invalid username or password",
    "change_password": "Change Password",
    "new_password": "New Password",
    "logout": "Logout",
    "confirm_logout": "Are you sure you want to logout?",
    "password_changed": "Password changed successfully",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: PropsWithChildren) => {
  const [language, setLanguage] = useState<Language>('th');

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
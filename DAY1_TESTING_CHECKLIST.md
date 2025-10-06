# Day 1 Testing Checklist

**Date:** October 5, 2025
**Dev Server:** http://localhost:5175/
**Status:** 🟢 READY FOR TESTING

---

## 🎯 Testing Approach

**Start with Dashboard → Then Voice Agent (Day 2)**

This ensures:
- Day 1 deliverables work perfectly
- User flow is smooth
- Natural progression to Day 2
- Real-world testing scenario

---

## ✅ Day 1 Testing Checklist

### **1. Initial Load**
- [ ] Navigate to http://localhost:5175/
- [ ] Login screen loads without errors
- [ ] SiteLogix logo displays
- [ ] UI looks clean and professional
- [ ] No console errors in browser

### **2. Login Interface**
- [ ] Manager dropdown shows 6 managers:
  - John Smith (mgr_001)
  - Sarah Johnson (mgr_002)
  - Mike Davis (mgr_003)
  - Emily Wilson (mgr_004)
  - Robert Brown (mgr_005)
  - Lisa Martinez (mgr_006)

- [ ] Project dropdown shows 4 projects:
  - Downtown Tower - 123 Main St, City, State (proj_001)
  - Riverside Complex - 456 River Rd, City, State (proj_002)
  - Industrial Park - 789 Industry Blvd, City, State (proj_003)
  - Shopping Center - 321 Mall Ave, City, State (proj_004)

- [ ] Validation works:
  - Click "Start Daily Report" without selections → Error message
  - Error message displays correctly

### **3. Login Success**
- [ ] Select Manager: "John Smith"
- [ ] Select Project: "Downtown Tower"
- [ ] Click "Start Daily Report"
- [ ] Main dashboard loads
- [ ] No console errors

### **4. Main Dashboard**
- [ ] Header shows:
  - "SiteLogix" title
  - "John Smith • Downtown Tower" subtitle
  - "Change Project" button

- [ ] Main content area shows:
  - "Daily Report" heading
  - Placeholder message for Day 2
  - Placeholder icon/graphic
  - Session information card

- [ ] Session information displays:
  - Manager: John Smith
  - Manager ID: mgr_001
  - Project: Downtown Tower
  - Project ID: proj_001
  - Location: 123 Main St, City, State

- [ ] Day 1 completion status banner shows:
  - Green background
  - Checkmark icon
  - "Day 1 Foundation Complete" heading
  - All 5 checkmarks visible

### **5. Session Persistence**
- [ ] Refresh the page (F5)
- [ ] Dashboard reloads (not login screen)
- [ ] Manager and project info persists
- [ ] Session data still correct

### **6. Logout/Change Project**
- [ ] Click "Change Project" button
- [ ] Returns to login screen
- [ ] Dropdowns are cleared/reset
- [ ] Can select different manager/project
- [ ] New session works correctly

### **7. Mobile Responsiveness**
- [ ] Resize browser to mobile width (375px)
- [ ] Login screen looks good on mobile
- [ ] Dashboard looks good on mobile
- [ ] No horizontal scrolling
- [ ] All elements readable

### **8. Browser Console**
- [ ] Open DevTools (F12)
- [ ] Check Console tab
- [ ] No red errors
- [ ] No warnings (acceptable if minor)

### **9. LocalStorage**
- [ ] DevTools → Application → Local Storage
- [ ] Verify keys exist:
  - `sitelogix_manager`
  - `sitelogix_project`
- [ ] Manager object contains: id, name
- [ ] Project object contains: id, name, location

### **10. Network Tab**
- [ ] DevTools → Network tab
- [ ] Refresh page
- [ ] All assets load successfully (200 status)
- [ ] No 404 errors
- [ ] CSS/JS files load correctly

---

## 🎨 Visual Quality Check

### Login Screen
- [ ] Gradient background looks good (blue)
- [ ] White card is centered
- [ ] Logo/icon displays properly
- [ ] Dropdowns styled correctly
- [ ] Button has hover effect
- [ ] Typography is clean
- [ ] Spacing looks professional

### Dashboard
- [ ] Header has subtle shadow
- [ ] Content is well-spaced
- [ ] Cards have proper borders/shadows
- [ ] Green success banner stands out
- [ ] Info grid is readable
- [ ] Icons render correctly

---

## 🐛 Known Issues to Watch For

- [ ] Tailwind classes not applying (would see unstyled elements)
- [ ] Import errors for AdminLogin component
- [ ] LocalStorage permission issues (private browsing)
- [ ] React hooks warnings
- [ ] Missing dependencies

---

## 📸 Screenshot Checklist

Take screenshots of:
1. [ ] Login screen (empty)
2. [ ] Login screen (with selections)
3. [ ] Login validation error
4. [ ] Main dashboard (full view)
5. [ ] Session info card (close-up)
6. [ ] Mobile view (375px width)

---

## ✅ Success Criteria

**All must pass:**
- ✅ Login screen loads without errors
- ✅ Both dropdowns work
- ✅ Validation prevents empty submission
- ✅ Dashboard loads after login
- ✅ Session info displays correctly
- ✅ Session persists on refresh
- ✅ Change project works
- ✅ Mobile responsive
- ✅ No console errors

---

## 🔄 If Issues Found

### Quick Fixes
1. **Tailwind not working:** Check `index.css` has `@tailwind` directives
2. **Component not found:** Verify import path in `App.tsx`
3. **Blank screen:** Check browser console for errors
4. **Styling broken:** Verify `tailwind.config.js` exists

### Need Help?
- Check `npm run dev` output for build errors
- Review browser console for runtime errors
- Verify all files created in Day 1 work

---

## 📝 Test Results Template

```
TESTED BY: [Your Name]
DATE: October 5, 2025
TIME: [Test Time]
BROWSER: [Chrome/Firefox/Safari]

LOGIN SCREEN: ✅ PASS / ❌ FAIL
DASHBOARD: ✅ PASS / ❌ FAIL
SESSION PERSISTENCE: ✅ PASS / ❌ FAIL
MOBILE RESPONSIVE: ✅ PASS / ❌ FAIL

ISSUES FOUND:
1. [Description]
2. [Description]

OVERALL STATUS: ✅ READY FOR DAY 2 / ❌ NEEDS FIXES
```

---

## 🚀 After Day 1 Testing Passes

**Next Steps:**
1. Document test results
2. Take screenshots for documentation
3. Begin Day 2 development:
   - Voice recording interface
   - MediaRecorder API integration
   - Audio file upload to S3
   - Verify SiteLogix folder structure

---

## 🎯 Testing URL

**Open in browser:**
```
http://localhost:5175/
```

**Dev server status:**
```bash
# Check if running
ps aux | grep vite

# View logs
# (Already running in background)
```

---

**Ready to test!** 🚀

Open http://localhost:5175/ in your browser and start with the login screen.

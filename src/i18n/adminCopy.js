const ar = {
  appName: 'إسهام', superAdmin: 'Super Admin', categoryAdmin: 'Category Admin',
  dashboard: 'لوحة التحكم', admins: 'المديرون', users: 'المستخدمون', courses: 'الكورسات', categories: 'التصنيفات', reports: 'التقارير', announcements: 'الإعلانات', activity: 'سجل النشاط', activityPlural: 'سجل النشاطات', notifications: 'الإشعارات', logout: 'تسجيل الخروج',
  openMenu: 'فتح القائمة', closeMenu: 'إغلاق القائمة', menu: 'القائمة', language: 'اللغة', theme: 'المظهر', lightMode: 'الوضع الفاتح', darkMode: 'الوضع الداكن', profile: 'الملف الشخصي', systemOk: 'النظام يعمل بشكل طبيعي', manager: 'أحمد محمد',
};
const en = {
  appName: 'Esham', superAdmin: 'Super Admin', categoryAdmin: 'Category Admin',
  dashboard: 'Dashboard', admins: 'Admins', users: 'Users', courses: 'Courses', categories: 'Categories', reports: 'Reports', announcements: 'Announcements', activity: 'Activity log', activityPlural: 'Activity log', notifications: 'Notifications', logout: 'Log out',
  openMenu: 'Open menu', closeMenu: 'Close menu', menu: 'Menu', language: 'Language', theme: 'Theme', lightMode: 'Light mode', darkMode: 'Dark mode', profile: 'Profile', systemOk: 'All systems operational', manager: 'Ahmed Mohammad',
};
const text = {
  'مرحباً أحمد':'Welcome, Ahmed','نظرة عامة على أداء منصة إسهام وإدارتها.':'An overview of Esham platform activity and administration.',
  'إدارة المديرين':'Admin management','مدير نظام واحد وعدة مديرين للتصنيفات.':'One platform administrator and multiple category administrators.',
  'المستخدمون':'Users','متابعة حسابات مستخدمي المنصة وحالاتها.':'Manage platform user accounts and status.',
  'الكورسات':'Courses','متابعة كورسات المنصة. مراجعة القبول والرفض من اختصاص مدير التصنيف المسؤول.':'Monitor platform courses. Category administrators review and decide courses in their categories.',
  'التصنيفات':'Categories','إدارة تصنيفات المنصة وربطها بمديري التصنيفات.':'Manage platform categories and assign their administrators.',
  'التقارير':'Reports','مؤشرات موجزة للمنصة مبنية على بيانات العرض الحالية.':'A concise overview based on the current demo data.',
  'الإعلانات':'Announcements','إنشاء إعلانات المنصة وإدارة جمهورها وحالة نشرها.':'Create platform announcements and manage their audience and publishing status.',
  'سجل النشاط':'Activity log','سجل زمني للإجراءات الإدارية والعناصر المتأثرة.':'A timeline of administrative actions and affected records.',
  'إجمالي المستخدمين':'Total users','إجمالي الكورسات':'Total courses','المديرون':'Admins','قيد المراجعة':'Pending review','حسابات المنصة':'Platform accounts','جميع الحالات':'All statuses','بانتظار Category Admin':'Waiting for a Category Admin',
  'حالة الكورسات':'Course status','التوزيع حسب حالة النشر':'Breakdown by publishing status','منشورة':'Published','قيد المراجعة':'Pending review','مرفوضة':'Rejected','ملخص المديرين':'Admin summary','إدارة صلاحيات التصنيفات':'Category access management','يتولى مديرو التصنيفات مراجعة كورسات تصنيفاتهم.':'Category administrators review courses assigned to them.','عرض الكل ←':'View all →','إدارة المديرين ←':'Manage admins →','كل الكورسات ←':'All courses →','نشاط المنصة':'Platform activity','أحدث الإجراءات الإدارية':'Recent administrative actions',
  'إضافة Category Admin':'Add Category Admin','المدير':'Administrator','البريد الإلكتروني':'Email','نوع المدير':'Admin type','التصنيفات':'Categories','الحالة':'Status','تاريخ الإنشاء':'Created','الإجراءات':'Actions','Super Admin':'Super Admin','Category Admin':'Category Admin','كل المنصة':'Entire platform','حساب رئيسي':'Primary account','تعديل':'Edit','تفعيل':'Activate','تعطيل':'Deactivate','حفظ':'Save','إلغاء':'Cancel','إضافة Category Admin':'Add Category Admin','التصنيفات المسؤول عنها':'Assigned categories','الاسم':'Name',
  'ابحث بالاسم أو البريد الإلكتروني…':'Search name or email…','كل الأدوار':'All roles','كل الحالات':'All statuses','متعلم':'Learner','مدرب':'Instructor','متعلم ومدرب':'Learner and instructor','نشط':'Active','معطّل':'Inactive','تاريخ التسجيل':'Joined','آخر نشاط':'Last active',
  'كل تصنيفاتي':'My categories','بانتظار المراجعة':'Pending review','مقبول':'Approved','مرفوض':'Rejected','يحتاج تعديلات':'Changes requested','مسودة':'Draft','المدرب':'Instructor','التصنيف':'Category','مدير المراجعة':'Reviewer','تاريخ الإنشاء':'Created','آخر تحديث':'Last updated',
  'نمو المستخدمين':'User growth','نمو الكورسات':'Course growth','التصنيفات':'Categories','إجمالي الحسابات المسجلة':'Registered accounts','بانتظار مدير التصنيف':'Waiting for category admin','الكورسات حسب الحالة':'Courses by status','الكورسات حسب التصنيف':'Courses by category','نشاط المنصة':'Platform activity','آخر الإجراءات المسجلة':'Latest recorded actions',
  'إنشاء إعلان':'Create announcement','عنوان الإعلان':'Announcement title','المحتوى':'Content','الجمهور':'Audience','تاريخ النشر':'Published','كل المستخدمين':'All users','المتعلمون':'Learners','المدربون':'Instructors','مسودة':'Draft','منشور':'Published','إلغاء النشر':'Unpublish','نشر':'Publish','حذف':'Delete','هل أنت متأكد':'Are you sure?','حذف الإعلان':'Delete announcement',
  'المستخدم/المدير':'User / administrator','العملية':'Action','نوع العملية':'Action type','العنصر المتأثر':'Affected item','التاريخ والوقت':'Date and time','التفاصيل':'Details','لا توجد بيانات':'No records',
  'لوحة تحكم الأدمن':'Category Admin dashboard','راجع الكورسات الجديدة وتابع حالة المحتوى ضمن التصنيفات المسؤول عنها.':'Review new courses and track content in your assigned categories.','تم قبولها':'Approved','تم رفضها':'Rejected','تحتاج تعديلات':'Changes requested','ضمن التصنيفات المسندة إليك':'Within your assigned categories','النشاط الأخير':'Recent activity','إجراءات مرتبطة بتصنيفاتك':'Activity in your categories','كورسات بانتظار المراجعة':'Courses waiting for review','ابدأ مراجعة الطلبات الواردة':'Start reviewing incoming submissions','عنوان الكورس':'Course title','تاريخ الإرسال':'Submitted','الإجراء':'Action','مراجعة':'Review','الكورسات المسندة إليك لمتابعة المراجعة.':'Courses in your assigned categories for review.',
  'ابحث باسم الكورس':'Search course title','فلترة حسب التصنيف':'Filter by category','فلترة حسب الحالة':'Filter by status','ترتيب النتائج':'Sort results','الأحدث':'Newest','الأقدم':'Oldest','الوصف المختصر':'Short description','السابق':'Previous','التالي':'Next','التفاصيل':'Details','عرض':'Showing','من':'From','إلى':'To',
  'مراجعة الكورس':'Course review','تحقق من المعلومات والمحتوى قبل تسجيل قرار المراجعة.':'Review the course information and content before submitting a decision.','العودة إلى الكورسات':'Back to courses','عن الكورس':'About this course','أهداف الكورس':'Course objectives','ماذا سيتعلم الطالب':'Learning outcomes','محتوى الكورس':'Course curriculum','قائمة التحقق':'Review checklist','راجع كل بند قبل اتخاذ القرار.':'Check each item before deciding.','ملخص المراجعة':'Review summary','الأقسام':'Sections','الدروس':'Lessons','المدة التقديرية':'Estimated duration','نقطة':'points','ملاحظات المراجعة':'Review notes','قرار المراجعة':'Review decision','بعد التأكد من عناصر القائمة أعلاه':'After checking the items above','قبول الكورس':'Approve course','طلب تعديلات':'Request changes','رفض الكورس':'Reject course','تم تسجيل قرار المراجعة:':'Review decision recorded:','الكورس غير متاح':'Course unavailable','قد يكون الكورس خارج التصنيفات المسندة أو لم يعد موجوداً.':'The course may be outside your assigned categories or no longer available.',
  'تأكيد قبول الكورس':'Confirm course approval','هل أنت متأكد من قبول هذا الكورس؟ سيُسجل القرار في النشاطات.':'Are you sure you want to approve this course? The decision will be logged.','رفض الكورس':'Reject course','سبب الرفض':'Reason for rejection','ملاحظات التعديل':'Requested changes','اكتب سبب رفض الكورس…':'Enter the reason for rejection…','وضّح التعديلات المطلوبة من المدرب…':'Describe the changes requested from the instructor…','تأكيد القبول':'Confirm approval','تأكيد الرفض':'Confirm rejection','إرسال الملاحظات':'Send feedback','إغلاق':'Close',
  'قائمة الكورسات ضمن التصنيفات المسندة إليك لمتابعة المراجعة.':'Courses in your assigned categories for review.','سجل النشاطات':'Activity log','تابع قرارات المراجعة والنشاطات ضمن تصنيفاتك.':'Track review decisions and activity in your categories.','ابحث في النشاطات':'Search activity','كل الأنشطة':'All activity','نوع النشاط':'Activity type','رقم النشاط':'Activity ID','الوصف':'Description','المستخدم':'User','الكورس':'Course','فتح الكورس':'Open course','إشعارات الكورسات والقرارات المرتبطة بتصنيفاتك.':'Course and review notifications for your categories.','تحديد الكل كمقروء':'Mark all as read','الكل':'All','غير مقروء':'Unread','مقروء':'Read','تحديد كمقروء':'Mark as read','فتح الكورس المرتبط':'Open related course','لا توجد نتائج مطابقة.':'No matching records.','لا توجد إشعارات في هذا العرض.':'No notifications in this view.',
  'تم قبول كورس':'Course approved','تم رفض كورس':'Course rejected','تم طلب تعديلات':'Changes requested','تم إرسال كورس للمراجعة':'Course submitted for review','تم تعديل كورس':'Course updated','إضافة كورس':'Course added','تم نشر إعلان':'Announcement published','تعديل تصنيف':'Category updated','تغيير حالة مستخدم':'User status changed','إنشاء Category Admin':'Category Admin created','إنشاء تصنيف':'Category created','تعديل تصنيف':'Category updated',
};
const extendedText = {
  'مدير النظام ومديرو التصنيفات': 'Platform administrator and category administrators',
  'التصنيفات المسجلة': 'Registered categories',
  'غير معيّن': 'Unassigned',
  'تعطيل مستخدم': 'User deactivated',
  'مراجعة كورس': 'Course review',
  'نشر إعلان': 'Announcement published',
  'إضافة كورس': 'Course added',
  'تعديل مدير تصنيف': 'Category administrator updated',
  'تغيير حالة مدير': 'Administrator status changed',
  'مدير': 'Administrator',
  'مستخدم': 'User',
  'تصنيف': 'Category',
  'إعلان': 'Announcement',
  'اكتمال معلومات الكورس': 'Course information is complete',
  'وضوح وصف الكورس وأهدافه': 'Course description and objectives are clear',
  'تنظيم المحتوى والأقسام': 'Content and sections are organized',
  'مناسبة المحتوى للتصنيف': 'Content is appropriate for the category',
  'جودة المحتوى التعليمي': 'Educational content quality',
  'صورة توضيحية للكورس': 'Course cover image',
  'فيديو': 'Video',
  'قراءة': 'Reading',
  'ضمن التصنيفات المسندة إليك': 'Within your assigned categories',
  'إدارة المديرين ←': 'Manage admins →',
  'إضافة تصنيف': 'Add category',
  'إضافة Category Admin': 'Add Category Admin',
  'تعطيل': 'Deactivate',
  'تفعيل': 'Activate',
  'إلغاء النشر': 'Unpublish',
  'لا توجد نتائج مطابقة.': 'No matching results.',
  'لا توجد إشعارات في هذا العرض.': 'No notifications in this view.',
  'تحديد الكل كمقروء': 'Mark all as read',
  'كورس جديد بانتظار المراجعة': 'New course awaiting review',
  'تم تسجيل قرار المراجعة': 'Review decision recorded',
  'مدخل إلى تطوير الويب': 'Introduction to Web Development',
  'أساسيات تصميم تجربة المستخدم': 'UX Design Fundamentals',
  'مرحباً بكم في الفصل الجديد': 'Welcome to the new semester',
  'تحديث بيانات تصنيف البرمجة': 'Programming category details updated',
  'تعطيل حساب نور سمير': 'Noor Samir account deactivated',
  'تم نشر أساسيات تصميم تجربة المستخدم': 'Published UX Design Fundamentals',
  'نشر مرحباً بكم في الفصل الجديد': 'Published Welcome to the new semester',
  'لوحة التحكم': 'Dashboard',
  'الدور': 'Role',
  'العنوان': 'Title',
  'النقاط': 'Points',
  'اسم التصنيف': 'Category name',
  'إشعارات': 'Notifications',
  'مديرو التصنيف': 'Category administrators',
  'مدير النظام': 'Platform administrator',
  'أحمد محمد': 'Ahmed Mohammad',
  'تمت المراجعة': 'Reviewed',
  'إلغاء نشر إعلان': 'Unpublish announcement',
  'حذف إعلان': 'Delete announcement',
  'تعديل إعلان': 'Edit announcement',
  'تعديل التصنيف': 'Edit category',
  'تعديل / إسناد مدير': 'Edit / assign administrator',
  'تعديل Category Admin': 'Edit Category Admin',
  'حفظ كمسودة': 'Save as draft',
  'سجل النشاط ←': 'Activity log →',
  '＋ إضافة Category Admin': '+ Add Category Admin',
  '＋ إضافة تصنيف': '+ Add category',
  '＋ إنشاء إعلان': '+ Create announcement',
  '→ العودة إلى الكورسات': '← Back to courses',
  'أُرسل في': 'Submitted on',
  'تاريخ الإرسال': 'Submission date',
  'مهمة': 'Task',
  'نقطة': 'points',
  'تم إلغاء النشر': 'Announcement unpublished',
  'حساب رئيسي': 'Primary account',
  'التصميم': 'Design',
  'البرمجة': 'Programming',
  'علوم البيانات': 'Data Science',
  'الأعمال': 'Business',
  'قرار المراجعة غير صالح': 'Invalid review decision',
  'ملاحظة المراجعة مطلوبة': 'A review note is required',
  'الكورس غير موجود ضمن التصنيفات المسندة': 'The course is not in your assigned categories',
  'تم إرسال مدخل إلى تطوير الويب للمراجعة.': 'Introduction to Web Development was submitted for review.',
  'تم قبول كورس مبادئ البرمجة.': 'Programming Fundamentals was approved.',
  'تم رفض كورس تحليل البيانات باستخدام Python.': 'Data Analysis with Python was rejected.',
  'تم تسجيل قرار مراجعة مبادئ البرمجة.': 'The review decision for Programming Fundamentals was recorded.',
  'تم تحديث تفاصيل كورس تحليل البيانات باستخدام Python.': 'Data Analysis with Python course details were updated.',
  'الإشعارات': 'Notifications',
  'الكل (': 'All (',
  'غير مقروء (': 'Unread (',
  'مقروء (': 'Read (',
  'تم تحديث كورس': 'Course updated',
  'أرسل فادي حسن كورس مدخل إلى تطوير الويب للمراجعة.': 'Fadi Hasan submitted Introduction to Web Development for review.',
};

export const adminCopy = { ar, en };
export function translateAdminText(value, language = 'ar') {
  if (typeof value !== 'string') return value;
  if (language === 'ar') {
    if (value === 'Super Admin') return 'مدير النظام';
    if (value === 'Category Admin') return 'مدير التصنيف';
    if (value === 'Category Admins') return 'مديرو التصنيفات';
    if (value === 'إضافة Category Admin') return 'إضافة مدير تصنيف';
    if (value === 'بانتظار Category Admin') return 'بانتظار مدير التصنيف';
    if (value === '＋ إضافة Category Admin') return '＋ إضافة مدير تصنيف';
    if (value === 'تعديل Category Admin') return 'تعديل مدير التصنيف';
    return value;
  }
  const translated = text[value] || extendedText[value];
  if (translated) return translated;

  const scope = value.match(/^مسؤول عن (.+)$/);
  if (scope) {
    const categories = scope[1]
      .split('، ')
      .map((category) => text[category] || extendedText[category] || category);
    return `Responsible for ${categories.join(', ')}`;
  }

  const account = value.match(/^(تعديل|إنشاء) حساب (.+)$/);
  if (account) return `${account[1] === 'تعديل' ? 'Update' : 'Create'} account ${account[2]}`;

  const announcement = value.match(/^(تعديل|إنشاء) إعلان (.+)$/);
  if (announcement) return `${announcement[1] === 'تعديل' ? 'Edit' : 'Create'} announcement ${announcement[2]}`;

  const category = value.match(/^(تعديل|إنشاء) تصنيف (.+)$/);
  if (category) return `${category[1] === 'تعديل' ? 'Update' : 'Create'} category ${category[2]}`;

  const statusChange = value.match(/^تغيير حالة (?:حساب )?(.+)$/);
  if (statusChange) {
    return `${value.startsWith('تغيير حالة حساب') ? 'Account' : 'Administrator'} status changed: ${statusChange[1]}`;
  }

  const deletion = value.match(/^حذف (.+)$/);
  if (deletion) return `Delete ${deletion[1]}`;

  const announcementConfirmation = value.match(/^حذف الإعلان «(.+)»؟$/);
  if (announcementConfirmation) return `Delete announcement “${announcementConfirmation[1]}”?`;

  const count = value.match(/^(\d+) (مستخدم|كورسات)$/);
  if (count) return `${count[1]} ${count[2] === 'مستخدم' ? 'users' : 'courses'}`;

  const activityActions = [
    'تم قبول كورس',
    'تم رفض كورس',
    'تم طلب تعديلات',
    'تم إرسال كورس للمراجعة',
    'تم تعديل كورس',
    'إضافة كورس',
  ];
  for (const action of activityActions) {
    if (value.startsWith(`${action}: `)) {
      return `${text[action] || extendedText[action]}: ${value.slice(action.length + 2)}`;
    }
  }

  return value;
}
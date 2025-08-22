import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'es' | 'fr' | 'ar' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Common
    'dashboard': 'Dashboard',
    'students': 'Students',
    'teachers': 'Teachers',
    'reports': 'Reports',
    'settings': 'Settings',
    'logout': 'Logout',
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'search': 'Search',
    'export': 'Export',
    'import': 'Import',
    
    // Student Management
    'student.management': 'Student Management',
    'student.add': 'Add Student',
    'student.edit': 'Edit Student',
    'student.delete': 'Delete Student',
    'student.name': 'Student Name',
    'student.grade': 'Grade',
    'student.class': 'Class',
    'student.status': 'Status',
    'student.parent.email': 'Parent Email',
    'student.parent.phone': 'Parent Phone',
    
    // Teacher Management
    'teacher.management': 'Teacher Management',
    'teacher.add': 'Add Teacher',
    'teacher.edit': 'Edit Teacher',
    'teacher.delete': 'Delete Teacher',
    'teacher.name': 'Teacher Name',
    'teacher.email': 'Email',
    'teacher.phone': 'Phone',
    'teacher.grade': 'Grade',
    'teacher.students': 'Students',
    'teacher.reports': 'Reports Generated',
    
    // Voice Recording
    'voice.recording': 'Voice Recording',
    'voice.select.student': 'Select Student for Recording',
    'voice.start.recording': 'Start Recording',
    'voice.stop.recording': 'Stop Recording',
    'voice.transcribe': 'Transcribe Audio',
    'voice.generate.report': 'Generate AI Report',
    'voice.send.report': 'Send to Parent',
    
    // Reports
    'report.generated': 'AI Generated Report',
    'report.status.draft': 'Draft',
    'report.status.review': 'Review',
    'report.status.completed': 'Completed',
    
    // Analytics
    'analytics.total.students': 'Total Students',
    'analytics.total.teachers': 'Total Teachers',
    'analytics.total.reports': 'Total Reports',
    'analytics.parent.engagement': 'Parent Engagement',
    'analytics.avg.report.time': 'Average Report Time',
    
    // Messages
    'message.success': 'Success',
    'message.error': 'Error',
    'message.loading': 'Loading...',
    'message.confirm.delete': 'Are you sure you want to delete this item?',
  },
  es: {
    // Common
    'dashboard': 'Panel de Control',
    'students': 'Estudiantes',
    'teachers': 'Maestros',
    'reports': 'Reportes',
    'settings': 'Configuración',
    'logout': 'Cerrar Sesión',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'delete': 'Eliminar',
    'edit': 'Editar',
    'add': 'Agregar',
    'search': 'Buscar',
    'export': 'Exportar',
    'import': 'Importar',
    
    // Student Management
    'student.management': 'Gestión de Estudiantes',
    'student.add': 'Agregar Estudiante',
    'student.edit': 'Editar Estudiante',
    'student.delete': 'Eliminar Estudiante',
    'student.name': 'Nombre del Estudiante',
    'student.grade': 'Grado',
    'student.class': 'Clase',
    'student.status': 'Estado',
    'student.parent.email': 'Email del Padre',
    'student.parent.phone': 'Teléfono del Padre',
    
    // Teacher Management
    'teacher.management': 'Gestión de Maestros',
    'teacher.add': 'Agregar Maestro',
    'teacher.edit': 'Editar Maestro',
    'teacher.delete': 'Eliminar Maestro',
    'teacher.name': 'Nombre del Maestro',
    'teacher.email': 'Email',
    'teacher.phone': 'Teléfono',
    'teacher.grade': 'Grado',
    'teacher.students': 'Estudiantes',
    'teacher.reports': 'Reportes Generados',
    
    // Voice Recording
    'voice.recording': 'Grabación de Voz',
    'voice.select.student': 'Seleccionar Estudiante para Grabar',
    'voice.start.recording': 'Iniciar Grabación',
    'voice.stop.recording': 'Detener Grabación',
    'voice.transcribe': 'Transcribir Audio',
    'voice.generate.report': 'Generar Reporte IA',
    'voice.send.report': 'Enviar al Padre',
    
    // Reports
    'report.generated': 'Reporte Generado por IA',
    'report.status.draft': 'Borrador',
    'report.status.review': 'Revisión',
    'report.status.completed': 'Completado',
    
    // Analytics
    'analytics.total.students': 'Total de Estudiantes',
    'analytics.total.teachers': 'Total de Maestros',
    'analytics.total.reports': 'Total de Reportes',
    'analytics.parent.engagement': 'Compromiso de Padres',
    'analytics.avg.report.time': 'Tiempo Promedio de Reporte',
    
    // Messages
    'message.success': 'Éxito',
    'message.error': 'Error',
    'message.loading': 'Cargando...',
    'message.confirm.delete': '¿Está seguro de que desea eliminar este elemento?',
  },
  fr: {
    // Common
    'dashboard': 'Tableau de Bord',
    'students': 'Étudiants',
    'teachers': 'Enseignants',
    'reports': 'Rapports',
    'settings': 'Paramètres',
    'logout': 'Déconnexion',
    'save': 'Enregistrer',
    'cancel': 'Annuler',
    'delete': 'Supprimer',
    'edit': 'Modifier',
    'add': 'Ajouter',
    'search': 'Rechercher',
    'export': 'Exporter',
    'import': 'Importer',
    
    // Student Management
    'student.management': 'Gestion des Étudiants',
    'student.add': 'Ajouter un Étudiant',
    'student.edit': 'Modifier l\'Étudiant',
    'student.delete': 'Supprimer l\'Étudiant',
    'student.name': 'Nom de l\'Étudiant',
    'student.grade': 'Niveau',
    'student.class': 'Classe',
    'student.status': 'Statut',
    'student.parent.email': 'Email du Parent',
    'student.parent.phone': 'Téléphone du Parent',
    
    // Teacher Management
    'teacher.management': 'Gestion des Enseignants',
    'teacher.add': 'Ajouter un Enseignant',
    'teacher.edit': 'Modifier l\'Enseignant',
    'teacher.delete': 'Supprimer l\'Enseignant',
    'teacher.name': 'Nom de l\'Enseignant',
    'teacher.email': 'Email',
    'teacher.phone': 'Téléphone',
    'teacher.grade': 'Niveau',
    'teacher.students': 'Étudiants',
    'teacher.reports': 'Rapports Générés',
    
    // Voice Recording
    'voice.recording': 'Enregistrement Vocal',
    'voice.select.student': 'Sélectionner un Étudiant pour l\'Enregistrement',
    'voice.start.recording': 'Commencer l\'Enregistrement',
    'voice.stop.recording': 'Arrêter l\'Enregistrement',
    'voice.transcribe': 'Transcrire l\'Audio',
    'voice.generate.report': 'Générer un Rapport IA',
    'voice.send.report': 'Envoyer au Parent',
    
    // Reports
    'report.generated': 'Rapport Généré par IA',
    'report.status.draft': 'Brouillon',
    'report.status.review': 'Révision',
    'report.status.completed': 'Terminé',
    
    // Analytics
    'analytics.total.students': 'Total des Étudiants',
    'analytics.total.teachers': 'Total des Enseignants',
    'analytics.total.reports': 'Total des Rapports',
    'analytics.parent.engagement': 'Engagement des Parents',
    'analytics.avg.report.time': 'Temps Moyen de Rapport',
    
    // Messages
    'message.success': 'Succès',
    'message.error': 'Erreur',
    'message.loading': 'Chargement...',
    'message.confirm.delete': 'Êtes-vous sûr de vouloir supprimer cet élément?',
  },
  ar: {
    // Common
    'dashboard': 'لوحة التحكم',
    'students': 'الطلاب',
    'teachers': 'المعلمون',
    'reports': 'التقارير',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'save': 'حفظ',
    'cancel': 'إلغاء',
    'delete': 'حذف',
    'edit': 'تعديل',
    'add': 'إضافة',
    'search': 'بحث',
    'export': 'تصدير',
    'import': 'استيراد',
    
    // Student Management
    'student.management': 'إدارة الطلاب',
    'student.add': 'إضافة طالب',
    'student.edit': 'تعديل الطالب',
    'student.delete': 'حذف الطالب',
    'student.name': 'اسم الطالب',
    'student.grade': 'الصف',
    'student.class': 'الفصل',
    'student.status': 'الحالة',
    'student.parent.email': 'بريد الوالد الإلكتروني',
    'student.parent.phone': 'هاتف الوالد',
    
    // Teacher Management
    'teacher.management': 'إدارة المعلمين',
    'teacher.add': 'إضافة معلم',
    'teacher.edit': 'تعديل المعلم',
    'teacher.delete': 'حذف المعلم',
    'teacher.name': 'اسم المعلم',
    'teacher.email': 'البريد الإلكتروني',
    'teacher.phone': 'الهاتف',
    'teacher.grade': 'الصف',
    'teacher.students': 'الطلاب',
    'teacher.reports': 'التقارير المُنشأة',
    
    // Voice Recording
    'voice.recording': 'تسجيل الصوت',
    'voice.select.student': 'اختر طالباً للتسجيل',
    'voice.start.recording': 'بدء التسجيل',
    'voice.stop.recording': 'إيقاف التسجيل',
    'voice.transcribe': 'تحويل الصوت إلى نص',
    'voice.generate.report': 'إنشاء تقرير بالذكاء الاصطناعي',
    'voice.send.report': 'إرسال إلى الوالد',
    
    // Reports
    'report.generated': 'تقرير مُنشأ بالذكاء الاصطناعي',
    'report.status.draft': 'مسودة',
    'report.status.review': 'مراجعة',
    'report.status.completed': 'مكتمل',
    
    // Analytics
    'analytics.total.students': 'إجمالي الطلاب',
    'analytics.total.teachers': 'إجمالي المعلمين',
    'analytics.total.reports': 'إجمالي التقارير',
    'analytics.parent.engagement': 'مشاركة الوالدين',
    'analytics.avg.report.time': 'متوسط وقت التقرير',
    
    // Messages
    'message.success': 'نجح',
    'message.error': 'خطأ',
    'message.loading': 'جاري التحميل...',
    'message.confirm.delete': 'هل أنت متأكد من حذف هذا العنصر؟',
  },
  zh: {
    // Common
    'dashboard': '仪表板',
    'students': '学生',
    'teachers': '教师',
    'reports': '报告',
    'settings': '设置',
    'logout': '登出',
    'save': '保存',
    'cancel': '取消',
    'delete': '删除',
    'edit': '编辑',
    'add': '添加',
    'search': '搜索',
    'export': '导出',
    'import': '导入',
    
    // Student Management
    'student.management': '学生管理',
    'student.add': '添加学生',
    'student.edit': '编辑学生',
    'student.delete': '删除学生',
    'student.name': '学生姓名',
    'student.grade': '年级',
    'student.class': '班级',
    'student.status': '状态',
    'student.parent.email': '家长邮箱',
    'student.parent.phone': '家长电话',
    
    // Teacher Management
    'teacher.management': '教师管理',
    'teacher.add': '添加教师',
    'teacher.edit': '编辑教师',
    'teacher.delete': '删除教师',
    'teacher.name': '教师姓名',
    'teacher.email': '邮箱',
    'teacher.phone': '电话',
    'teacher.grade': '年级',
    'teacher.students': '学生',
    'teacher.reports': '生成的报告',
    
    // Voice Recording
    'voice.recording': '语音录制',
    'voice.select.student': '选择学生进行录制',
    'voice.start.recording': '开始录制',
    'voice.stop.recording': '停止录制',
    'voice.transcribe': '转录音频',
    'voice.generate.report': '生成AI报告',
    'voice.send.report': '发送给家长',
    
    // Reports
    'report.generated': 'AI生成的报告',
    'report.status.draft': '草稿',
    'report.status.review': '审查',
    'report.status.completed': '已完成',
    
    // Analytics
    'analytics.total.students': '学生总数',
    'analytics.total.teachers': '教师总数',
    'analytics.total.reports': '报告总数',
    'analytics.parent.engagement': '家长参与度',
    'analytics.avg.report.time': '平均报告时间',
    
    // Messages
    'message.success': '成功',
    'message.error': '错误',
    'message.loading': '加载中...',
    'message.confirm.delete': '您确定要删除此项目吗？',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 
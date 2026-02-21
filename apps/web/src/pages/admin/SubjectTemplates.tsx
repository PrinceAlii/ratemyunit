import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  FileCode,
  Plus,
  Edit,
  Trash2,
  Play,
  Eye,
  Loader2,
  School,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { University, SubjectCodeTemplate, TemplatePreviewResponse, TemplateType } from '@ratemyunit/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../../components/ui/alert-dialog';

interface TemplateFormData {
  name: string;
  universityId: string;
  templateType: TemplateType;
  codeList: string;
  description: string;
  faculty: string;
  priority: string;
  active: boolean;
}

interface FormErrors {
  name?: string;
  universityId?: string;
  codeList?: string;
}

interface TemplateQueueResult {
  jobsQueued: number;
  totalCodes: number;
  alreadyIndexed?: number;
}

export function SubjectTemplates() {
  const queryClient = useQueryClient();

  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<SubjectCodeTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<SubjectCodeTemplate | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<SubjectCodeTemplate | null>(null);

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    universityId: '',
    templateType: 'list',
    codeList: '',
    description: '',
    faculty: '',
    priority: '0',
    active: true,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const { data: universities } = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.get<University[]>('/api/public/universities'),
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['admin', 'templates', selectedUniversity],
    queryFn: () => api.get<SubjectCodeTemplate[]>('/api/admin/templates', {
      universityId: selectedUniversity || undefined,
    }),
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['admin', 'template-preview', previewingTemplate?.id],
    queryFn: () => api.post<TemplatePreviewResponse>(
      `/api/admin/templates/${previewingTemplate!.id}/preview`,
      {}
    ),
    enabled: !!previewingTemplate && previewDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SubjectCodeTemplate>) => api.post<SubjectCodeTemplate>('/api/admin/templates', data),
    onSuccess: () => {
      toast.success('Template created successfully');
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubjectCodeTemplate> }) =>
      api.patch<SubjectCodeTemplate>(`/api/admin/templates/${id}`, data),
    onSuccess: () => {
      toast.success('Template updated successfully');
      setEditDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/templates/${id}`),
    onSuccess: () => {
      toast.success('Template deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const queueMutation = useMutation({
    mutationFn: (id: string) => api.post<TemplateQueueResult>(`/api/admin/templates/${id}/queue`, {}),
    onSuccess: (response) => {
      const indexedInfo = response.alreadyIndexed
        ? ` (${response.alreadyIndexed} already indexed)`
        : '';
      toast.success(`Queued ${response.jobsQueued} subjects for scraping${indexedInfo}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scrape', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to queue template: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      universityId: '',
      templateType: 'list',
      codeList: '',
      description: '',
      faculty: '',
      priority: '0',
      active: true,
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.universityId) {
      errors.universityId = 'University is required';
    }

    if (!formData.codeList.trim()) {
      errors.codeList = 'Code list is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateClick = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const handleEditClick = (template: SubjectCodeTemplate) => {
    if (template.templateType !== 'list') {
      toast.error('Only list templates can be edited. Please delete legacy templates.');
      return;
    }
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      universityId: template.universityId,
      templateType: template.templateType,
      codeList: template.codeList?.join(', ') || '',
      description: template.description || '',
      faculty: template.faculty || '',
      priority: String(template.priority),
      active: template.active,
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (template: SubjectCodeTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handlePreviewClick = (template: SubjectCodeTemplate) => {
    setPreviewingTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleQueueClick = (template: SubjectCodeTemplate) => {
    if (template.templateType !== 'list') {
      toast.error('Only list templates can be queued.');
      return;
    }
    queueMutation.mutate(template.id);
  };

  const handleCreateSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const payload: Partial<SubjectCodeTemplate> = {
      name: formData.name.trim(),
      universityId: formData.universityId,
      templateType: 'list',
      description: formData.description.trim() || null,
      faculty: formData.faculty.trim() || null,
      priority: parseInt(formData.priority, 10) || 0,
      active: formData.active,
    };

    payload.codeList = formData.codeList
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    createMutation.mutate(payload);
  };

  const handleEditSubmit = () => {
    if (!validateForm() || !editingTemplate) {
      return;
    }

    const payload: Partial<SubjectCodeTemplate> = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      faculty: formData.faculty.trim() || null,
      priority: parseInt(formData.priority, 10) || 0,
      active: formData.active,
    };

    payload.codeList = formData.codeList
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    updateMutation.mutate({ id: editingTemplate.id, data: payload });
  };

  const confirmDelete = () => {
    if (deletingTemplate) {
      deleteMutation.mutate(deletingTemplate.id);
    }
  };

  const handleQueueFromPreview = () => {
    if (previewingTemplate) {
      setPreviewDialogOpen(false);
      queueMutation.mutate(previewingTemplate.id);
      setPreviewingTemplate(null);
    }
  };

  const renderDynamicFields = () => {
    return (
      <div>
        <Label htmlFor="codeList" className="font-bold uppercase text-sm">
          Code List (comma-separated) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="codeList"
          placeholder="e.g., 31251, 31252, 31271"
          value={formData.codeList}
          onChange={(e) => setFormData({ ...formData, codeList: e.target.value })}
          rows={4}
          className={`border-3 font-mono ${formErrors.codeList ? 'border-destructive' : ''}`}
        />
        {formErrors.codeList && (
          <p className="text-xs text-destructive font-medium mt-1">{formErrors.codeList}</p>
        )}
      </div>
    );
  };

  const getTemplateTypeLabel = (type: TemplateType): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const sortedTemplates = templates
    ? [...templates].sort((a, b) => b.priority - a.priority)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-display font-black uppercase">Subject Code Templates</h2>
        </div>
        <Button onClick={handleCreateClick} className="h-12 border-4 font-bold">
          <Plus className="h-5 w-5 mr-2" />
          Create Template
        </Button>
      </div>

      {/* University Filter */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <div className="space-y-2">
          <Label className="font-bold uppercase text-sm flex items-center gap-2">
            <School className="h-4 w-4" />
            Filter by University
          </Label>
          <select
            className="flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo"
            value={selectedUniversity}
            onChange={(e) => setSelectedUniversity(e.target.value)}
          >
            <option value="">All Universities</option>
            {universities?.map((uni) => (
              <option key={uni.id} value={uni.id}>
                {uni.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates Table */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <h3 className="text-xl font-display font-black uppercase mb-4">Templates</h3>
        {templatesLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : sortedTemplates.length === 0 ? (
          <div className="text-center py-8">
            <FileCode className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="font-bold text-muted-foreground">
              No templates found. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="border-3 border-foreground overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted font-bold border-b-3 border-foreground">
                <tr>
                  <th className="px-4 py-4 uppercase">Name</th>
                  <th className="px-4 py-4 uppercase">Type</th>
                  <th className="px-4 py-4 uppercase">Faculty</th>
                  <th className="px-4 py-4 uppercase">Priority</th>
                  <th className="px-4 py-4 uppercase">Status</th>
                  <th className="px-4 py-4 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-3 divide-foreground">
                {sortedTemplates.map((template) => (
                  <tr key={template.id} className="hover:bg-muted/50">
                    <td className="px-4 py-4 font-bold">{template.name}</td>
                    <td className="px-4 py-4 font-medium">
                      <span className="px-2 py-1 bg-secondary text-secondary-foreground border-2 border-foreground text-xs font-bold uppercase">
                        {getTemplateTypeLabel(template.templateType)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium">{template.faculty || '-'}</td>
                    <td className="px-4 py-4 font-mono font-bold">{template.priority}</td>
                    <td className="px-4 py-4">
                      {template.active ? (
                        <span className="flex items-center gap-1 text-green-700 font-bold">
                          <CheckCircle className="h-4 w-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground font-bold">
                          <AlertCircle className="h-4 w-4" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewClick(template)}
                          className="h-9"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditClick(template)}
                          className="h-9"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleQueueClick(template)}
                          disabled={queueMutation.isPending || template.templateType !== 'list'}
                          className="h-9"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Queue
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(template)}
                          className="h-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="h-6 w-6" />
              Create Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Create a new subject code template for automatic unit discovery.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="font-bold uppercase text-sm">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., IT & Engineering"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`h-12 border-3 ${formErrors.name ? 'border-destructive' : ''}`}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive font-medium mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="universityId" className="font-bold uppercase text-sm">
                University <span className="text-destructive">*</span>
              </Label>
              <select
                id="universityId"
                className={`flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo ${
                  formErrors.universityId ? 'border-destructive' : ''
                }`}
                value={formData.universityId}
                onChange={(e) => setFormData({ ...formData, universityId: e.target.value })}
              >
                <option value="">Select a university</option>
                {universities?.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
              {formErrors.universityId && (
                <p className="text-xs text-destructive font-medium mt-1">{formErrors.universityId}</p>
              )}
            </div>

            <div>
              <Label className="font-bold uppercase text-sm">
                Template Type
              </Label>
              <div className="flex h-12 w-full items-center border-3 border-input bg-muted px-3 py-2 text-sm font-bold uppercase shadow-neo-sm">
                List
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Only list templates are supported for UTS subject indexing.
              </p>
            </div>

            {renderDynamicFields()}

            <div>
              <Label htmlFor="description" className="font-bold uppercase text-sm">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="border-3"
              />
            </div>

            <div>
              <Label htmlFor="faculty" className="font-bold uppercase text-sm">
                Faculty
              </Label>
              <Input
                id="faculty"
                placeholder="e.g., Engineering"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                className="h-12 border-3"
              />
            </div>

            <div>
              <Label htmlFor="priority" className="font-bold uppercase text-sm">
                Priority
              </Label>
              <Input
                id="priority"
                type="number"
                placeholder="0"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="h-12 border-3"
              />
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Higher priority templates are processed first.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-5 w-5 border-3 border-foreground"
              />
              <Label htmlFor="active" className="font-bold text-sm cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
              className="h-12 border-4 font-bold"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Template'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Template Dialog */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Edit className="h-6 w-6" />
              Edit Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Update the subject code template configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="font-bold uppercase text-sm">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="e.g., IT & Engineering"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`h-12 border-3 ${formErrors.name ? 'border-destructive' : ''}`}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive font-medium mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-universityId" className="font-bold uppercase text-sm">
                University <span className="text-destructive">*</span>
              </Label>
              <select
                id="edit-universityId"
                className={`flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo ${
                  formErrors.universityId ? 'border-destructive' : ''
                }`}
                value={formData.universityId}
                onChange={(e) => setFormData({ ...formData, universityId: e.target.value })}
                disabled
              >
                <option value="">Select a university</option>
                {universities?.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                University cannot be changed after creation.
              </p>
              {formErrors.universityId && (
                <p className="text-xs text-destructive font-medium mt-1">{formErrors.universityId}</p>
              )}
            </div>

            <div>
              <Label className="font-bold uppercase text-sm">
                Template Type
              </Label>
              <div className="flex h-12 w-full items-center border-3 border-input bg-muted px-3 py-2 text-sm font-bold uppercase shadow-neo-sm">
                List
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Template type is fixed to list.
              </p>
            </div>

            {renderDynamicFields()}

            <div>
              <Label htmlFor="edit-description" className="font-bold uppercase text-sm">
                Description
              </Label>
              <Textarea
                id="edit-description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="border-3"
              />
            </div>

            <div>
              <Label htmlFor="edit-faculty" className="font-bold uppercase text-sm">
                Faculty
              </Label>
              <Input
                id="edit-faculty"
                placeholder="e.g., Engineering"
                value={formData.faculty}
                onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                className="h-12 border-3"
              />
            </div>

            <div>
              <Label htmlFor="edit-priority" className="font-bold uppercase text-sm">
                Priority
              </Label>
              <Input
                id="edit-priority"
                type="number"
                placeholder="0"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="h-12 border-3"
              />
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Higher priority templates are processed first.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-5 w-5 border-3 border-foreground"
              />
              <Label htmlFor="edit-active" className="font-bold text-sm cursor-pointer">
                Active
              </Label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setEditDialogOpen(false);
              setEditingTemplate(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleEditSubmit}
              disabled={updateMutation.isPending}
              className="h-12 border-4 font-bold"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Template'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <AlertDialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open) setPreviewingTemplate(null);
      }}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-6 w-6" />
              Template Preview: {previewingTemplate?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Preview of subject codes generated by this template.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 overflow-y-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner className="h-8 w-8" />
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted border-3 border-foreground">
                  <p className="font-bold text-sm">
                    Total codes: <span className="text-primary">{previewData.total}</span>
                    {previewData.truncated && (
                      <span className="text-muted-foreground"> (showing first 50)</span>
                    )}
                  </p>
                </div>
                <div className="p-4 border-3 border-foreground bg-background">
                  <div className="grid grid-cols-5 gap-2 font-mono text-sm">
                    {previewData.codes.map((code: string, idx: number) => (
                      <div
                        key={idx}
                        className="px-3 py-2 bg-secondary text-secondary-foreground border-2 border-foreground font-bold text-center"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-bold">
                No preview available
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <Button
              onClick={handleQueueFromPreview}
              disabled={queueMutation.isPending}
              className="h-12 border-4 font-bold"
            >
              {queueMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Queueing...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Queue Jobs
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Template?"
        description={
          deletingTemplate
            ? `Are you sure you want to delete the template "${deletingTemplate.name}" (${getTemplateTypeLabel(
                deletingTemplate.templateType
              )})? This action will soft delete the template and it can be recovered later.`
            : ''
        }
        confirmText="Delete Template"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

from django.contrib import admin

from .models import (
    Project, ProjectMember, ProjectPost, PostAttachment,
    ProjectAssignment, AssignmentAttachment, AssignmentSubmission, SubmissionFile,
)

admin.site.register(Project)
admin.site.register(ProjectMember)
admin.site.register(ProjectPost)
admin.site.register(PostAttachment)
admin.site.register(ProjectAssignment)
admin.site.register(AssignmentAttachment)
admin.site.register(AssignmentSubmission)
admin.site.register(SubmissionFile)

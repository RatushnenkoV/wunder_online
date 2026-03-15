from django.urls import path

from . import views

urlpatterns = [
    # Projects
    path('', views.ProjectListView.as_view()),
    path('<int:pk>/', views.ProjectDetailView.as_view()),

    # Users search
    path('users/', views.ProjectUsersView.as_view()),

    # Members
    path('<int:pk>/members/', views.ProjectMembersView.as_view()),
    path('<int:pk>/members/bulk/', views.ProjectMembersBulkView.as_view()),
    path('<int:pk>/members/<int:uid>/', views.ProjectMemberDetailView.as_view()),

    # Posts (лента)
    path('<int:pk>/posts/', views.ProjectPostListView.as_view()),
    path('<int:pk>/posts/<int:pid>/', views.ProjectPostDetailView.as_view()),
    path('<int:pk>/posts/<int:pid>/files/', views.ProjectPostFileView.as_view()),

    # Assignments
    path('<int:pk>/assignments/', views.ProjectAssignmentListView.as_view()),
    path('<int:pk>/assignments/<int:aid>/', views.ProjectAssignmentDetailView.as_view()),
    path('<int:pk>/assignments/<int:aid>/files/', views.AssignmentFileView.as_view()),

    # Submissions
    path('<int:pk>/assignments/<int:aid>/submissions/', views.AssignmentSubmissionsView.as_view()),
    path('<int:pk>/assignments/<int:aid>/submissions/<int:sid>/', views.AssignmentSubmissionDetailView.as_view()),
    path('<int:pk>/assignments/<int:aid>/submissions/<int:sid>/files/', views.SubmissionFileView.as_view()),
    path('<int:pk>/assignments/<int:aid>/submissions/<int:sid>/accept/', views.AcceptSubmissionView.as_view()),
    path('<int:pk>/assignments/<int:aid>/submissions/<int:sid>/send-back/', views.SendBackSubmissionView.as_view()),
]

from django.urls import path
from . import views

urlpatterns = [
    # CTP
    path('', views.ctp_list_create),
    path('<int:pk>/', views.ctp_detail),
    path('<int:pk>/copy/', views.ctp_copy),
    # Topics
    path('<int:ctp_id>/topics/', views.topic_list_create),
    path('<int:ctp_id>/topics/bulk-create/', views.topic_bulk_create),
    path('<int:ctp_id>/topics/reorder/', views.topic_reorder),
    path('<int:ctp_id>/topics/bulk-delete/', views.topic_bulk_delete),
    path('<int:ctp_id>/topics/duplicate/', views.topic_duplicate),
    path('<int:ctp_id>/topics/import/', views.topic_import),
    path('<int:ctp_id>/topics/autofill-dates/', views.topic_autofill_dates),
    path('topics/<int:pk>/', views.topic_detail),
    # Topic files
    path('topics/<int:pk>/files/', views.topic_file_upload),
    path('topics/<int:pk>/files/<int:file_id>/', views.topic_file_delete),
    # Topics by date
    path('topics-by-date/', views.topics_by_date),
    # Holidays
    path('holidays/', views.holiday_list_create),
    path('holidays/<int:pk>/', views.holiday_delete),
]

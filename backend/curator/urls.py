from django.urls import path
from . import views

urlpatterns = [
    path('structure/', views.structure_view),
    path('my-class/', views.my_class_view),
    path('reports/<int:student_id>/', views.student_report_view),
    path('hints/', views.hints_list_create),
    path('hints/<int:pk>/', views.hint_detail),
]

from rest_framework.pagination import PageNumberPagination


class AdminListPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if self.page_query_param not in request.query_params and self.page_size_query_param not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)

    def get_page_number(self, request, paginator):
        page_number = super().get_page_number(request, paginator)
        try:
            # A filtered page can shrink after a successful edit.
            return min(int(page_number), paginator.num_pages)
        except (TypeError, ValueError):
            return page_number

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data["page"] = self.page.number
        return response

    def get_paginated_response_schema(self, schema):
        envelope = super().get_paginated_response_schema(schema)
        envelope["properties"]["page"] = {"type": "integer", "minimum": 1}
        envelope["required"] += ["page"]
        return {"oneOf": [schema, envelope]}

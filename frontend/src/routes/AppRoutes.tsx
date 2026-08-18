import { Suspense } from "react";
import { Route, Routes } from "react-router";

import { PageLoader } from "../components/ui/PageLoader";
import { lazyNamed } from "../utils/lazyNamed";

import { MainLayout } from "../components/layout/MainLayout";
import { AccountLayout } from "../components/layout/AccountLayout";
import { SellerLayout } from "../components/layout/SellerLayout";
import { AdminLayout } from "../components/layout/AdminLayout";

import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ProductDetailPage } from "../pages/ProductDetailPage";
import { ProfilePage } from "../pages/ProfilePage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { OrderConfirmationPage } from "../pages/OrderConfirmationPage";

import { NotificationsPage } from "../pages/NotificationsPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { NotFoundPage } from "../pages/NotFoundPage";

import { AccountOverviewPage } from "../pages/account/AccountOverviewPage";
import { AddressesPage } from "../pages/account/AddressesPage";
import { ComplaintsPage } from "../pages/account/ComplaintsPage";
import { CreateComplaintPage } from "../pages/account/CreateComplaintPage";
import { CreateReturnPage } from "../pages/account/CreateReturnPage";
import { FavoritesPage } from "../pages/account/FavoritesPage";
import { MyQuestionsPage } from "../pages/account/MyQuestionsPage";
import { MyReviewsPage } from "../pages/account/MyReviewsPage";
import { OrderDetailPage } from "../pages/account/OrderDetailPage";
import { OrdersPage } from "../pages/account/OrdersPage";
import { OrderTrackingPage } from "../pages/account/OrderTrackingPage";
import { ReturnsPage } from "../pages/account/ReturnsPage";

import { ProtectedRoute } from "./ProtectedRoute";
import { RoleProtectedRoute } from "./RoleProtectedRoute";


// =========================
// LAZY LOADING - SELLER
// =========================

const SellerDashboardPage = lazyNamed(
  () => import("../pages/SellerDashboardPage"),
  "SellerDashboardPage"
);

const SellerProductsPage = lazyNamed(
  () => import("../pages/seller/SellerProductsPage"),
  "SellerProductsPage"
);

const SellerProductFormPage = lazyNamed(
  () => import("../pages/seller/SellerProductFormPage"),
  "SellerProductFormPage"
);

const SellerStockPage = lazyNamed(
  () => import("../pages/seller/SellerStockPage"),
  "SellerStockPage"
);

const SellerOrdersPage = lazyNamed(
  () => import("../pages/seller/SellerOrdersPage"),
  "SellerOrdersPage"
);

const SellerOrderDetailPage = lazyNamed(
  () => import("../pages/seller/SellerOrderDetailPage"),
  "SellerOrderDetailPage"
);

const SellerQuestionsPage = lazyNamed(
  () => import("../pages/seller/SellerQuestionsPage"),
  "SellerQuestionsPage"
);

const SellerIssuesPage = lazyNamed(
  () => import("../pages/seller/SellerIssuesPage"),
  "SellerIssuesPage"
);

// =========================
// LAZY LOADING - ADMIN
// =========================

const AdminDashboardPage = lazyNamed(
  () => import("../pages/AdminDashboardPage"),
  "AdminDashboardPage"
);

const AdminUsersPage = lazyNamed(
  () => import("../pages/admin/AdminUsersPage"),
  "AdminUsersPage"
);

const AdminSellersPage = lazyNamed(
  () => import("../pages/admin/AdminSellersPage"),
  "AdminSellersPage"
);

const AdminProductsPage = lazyNamed(
  () => import("../pages/admin/AdminProductsPage"),
  "AdminProductsPage"
);

const AdminOrdersPage = lazyNamed(
  () => import("../pages/admin/AdminOrdersPage"),
  "AdminOrdersPage"
);

const AdminOrderDetailPage = lazyNamed(
  () => import("../pages/admin/AdminOrderDetailPage"),
  "AdminOrderDetailPage"
);

const AdminPaymentsPage = lazyNamed(
  () => import("../pages/admin/AdminPaymentsPage"),
  "AdminPaymentsPage"
);

const AdminShipmentsPage = lazyNamed(
  () => import("../pages/admin/AdminShipmentsPage"),
  "AdminShipmentsPage"
);

const AdminComplaintsPage = lazyNamed(
  () => import("../pages/admin/AdminComplaintsPage"),
  "AdminComplaintsPage"
);

const AdminReturnsPage = lazyNamed(
  () => import("../pages/admin/AdminReturnsPage"),
  "AdminReturnsPage"
);

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route element={<MainLayout />}>
        {/* =========================
            RUTAS PÚBLICAS
        ========================= */}

        <Route path="/" element={<HomePage />} />

        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<RegisterPage />} />

        <Route path="/products" element={<ProductsPage />} />

        <Route
          path="/products/:slug"
          element={<ProductDetailPage />}
        />

        <Route
          path="/403"
          element={<ForbiddenPage />}
        />

        {/* =========================
            USUARIO AUTENTICADO
        ========================= */}

        <Route element={<ProtectedRoute />}>
          <Route
            path="/account"
            element={<AccountLayout />}
          >
            <Route
              index
              element={<AccountOverviewPage />}
            />

            <Route
              path="orders"
              element={<OrdersPage />}
            />

            <Route
              path="orders/:orderId"
              element={<OrderDetailPage />}
            />

            <Route
              path="orders/:orderId/tracking"
              element={<OrderTrackingPage />}
            />

            <Route
              path="orders/:orderId/complaint"
              element={<CreateComplaintPage />}
            />

            <Route
              path="orders/:orderId/items/:itemId/return"
              element={<CreateReturnPage />}
            />

            <Route
              path="favorites"
              element={<FavoritesPage />}
            />

            <Route
              path="addresses"
              element={<AddressesPage />}
            />

            <Route
              path="questions"
              element={<MyQuestionsPage />}
            />

            <Route
              path="reviews"
              element={<MyReviewsPage />}
            />

            <Route
              path="complaints"
              element={<ComplaintsPage />}
            />

            <Route
              path="returns"
              element={<ReturnsPage />}
            />
          </Route>

          <Route
            path="/profile"
            element={<ProfilePage />}
          />

          <Route
            path="/cart"
            element={<CartPage />}
          />

          <Route
            path="/checkout"
            element={<CheckoutPage />}
          />

          <Route
            path="/orders/:orderId/confirmation"
            element={<OrderConfirmationPage />}
          />

          <Route
            path="/notifications"
            element={<NotificationsPage />}
          />
        </Route>

        {/* =========================
            PORTAL VENDEDOR
        ========================= */}

        <Route
          element={
            <RoleProtectedRoute
              allowedRoles={["SELLER"]}
            />
          }
        >
          <Route
            path="/seller"
            element={<SellerLayout />}
          >
            <Route
              index
              element={<SellerDashboardPage />}
            />

            <Route
              path="products"
              element={<SellerProductsPage />}
            />

            <Route
              path="products/new"
              element={<SellerProductFormPage />}
            />

            <Route
              path="products/:productId/edit"
              element={<SellerProductFormPage />}
            />

            <Route
              path="products/:productId/stock"
              element={<SellerStockPage />}
            />

            <Route
              path="stock"
              element={<SellerStockPage />}
            />

            <Route
              path="orders"
              element={<SellerOrdersPage />}
            />

            <Route
              path="orders/:orderId"
              element={<SellerOrderDetailPage />}
            />

            <Route
              path="questions"
              element={<SellerQuestionsPage />}
            />

            <Route
              path="issues"
              element={<SellerIssuesPage />}
            />
          </Route>
        </Route>

        {/* =========================
            ADMINISTRACIÓN
        ========================= */}

        <Route
          element={
            <RoleProtectedRoute
              allowedRoles={[
                "ADMIN",
                "SUPERADMIN",
              ]}
            />
          }
        >
          <Route
            path="/admin"
            element={<AdminLayout />}
          >
            <Route
              index
              element={<AdminDashboardPage />}
            />

            <Route
              path="users"
              element={<AdminUsersPage />}
            />

            <Route
              path="sellers"
              element={<AdminSellersPage />}
            />

            <Route
              path="products"
              element={<AdminProductsPage />}
            />

            <Route
              path="orders"
              element={<AdminOrdersPage />}
            />

            <Route
              path="orders/:orderId"
              element={<AdminOrderDetailPage />}
            />

            <Route
              path="payments"
              element={<AdminPaymentsPage />}
            />

            <Route
              path="shipments"
              element={<AdminShipmentsPage />}
            />

            <Route
              path="complaints"
              element={<AdminComplaintsPage />}
            />

            <Route
              path="returns"
              element={<AdminReturnsPage />}
            />
          </Route>
        </Route>

        {/* =========================
            404
        ========================= */}

        <Route
          path="*"
          element={<NotFoundPage />}
        />
      </Route>
      </Routes>
    </Suspense>
  );
}
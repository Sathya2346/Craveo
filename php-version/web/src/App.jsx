import { Route, Routes } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout.jsx';
import PublicLayout from './components/layout/PublicLayout.jsx';
import { GuestOnlyRoute, ProtectedRoute } from './components/ui/RouteGuards.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import RestaurantsPage from './pages/Restaurants.jsx';
import RestaurantDetail from './pages/RestaurantDetail.jsx';
import BrowseFoods from './pages/BrowseFoods.jsx';
import FoodDetail from './pages/FoodDetail.jsx';
import Offers from './pages/Offers.jsx';
import CartPage from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Favourites from './pages/Favourites.jsx';
import Profile from './pages/Profile.jsx';
import NotFound from './pages/NotFound.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminOrderDetail from './pages/admin/AdminOrderDetail.jsx';
import AdminFoods from './pages/admin/AdminFoods.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminRestaurants from './pages/admin/AdminRestaurants.jsx';
import AdminCoupons from './pages/admin/AdminCoupons.jsx';
import AdminBanners from './pages/admin/AdminBanners.jsx';
import AdminReviews from './pages/admin/AdminReviews.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

const App = () => (
  <Routes>
    <Route element={<PublicLayout />}>
      <Route index element={<Home />} />
      <Route path="restaurants" element={<RestaurantsPage />} />
      <Route path="restaurant/:slug" element={<RestaurantDetail />} />
      <Route path="foods" element={<BrowseFoods />} />
      <Route path="category/:slug" element={<BrowseFoods />} />
      <Route path="food/:id" element={<FoodDetail />} />
      <Route path="offers" element={<Offers />} />
      <Route path="cart" element={<CartPage />} />
      <Route
        path="checkout"
        element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        }
      />
      <Route
        path="order-success/:id"
        element={
          <ProtectedRoute>
            <OrderSuccess />
          </ProtectedRoute>
        }
      />
      <Route
        path="orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="orders/:id"
        element={
          <ProtectedRoute>
            <OrderDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="favourites"
        element={
          <ProtectedRoute>
            <Favourites />
          </ProtectedRoute>
        }
      />
      <Route
        path="profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="login"
        element={
          <GuestOnlyRoute>
            <Login />
          </GuestOnlyRoute>
        }
      />
      <Route
        path="register"
        element={
          <GuestOnlyRoute>
            <Register />
          </GuestOnlyRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Route>

    <Route
      path="/admin"
      element={
        <ProtectedRoute roles={['ADMIN', 'MANAGER']}>
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Dashboard />} />
      <Route path="orders" element={<AdminOrders />} />
      <Route path="orders/:id" element={<AdminOrderDetail />} />
      <Route path="foods" element={<AdminFoods />} />
      <Route path="categories" element={<AdminCategories />} />
      <Route path="restaurants" element={<AdminRestaurants />} />
      <Route path="coupons" element={<AdminCoupons />} />
      <Route path="banners" element={<AdminBanners />} />
      <Route path="reviews" element={<AdminReviews />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="settings" element={<AdminSettings />} />
    </Route>
  </Routes>
);

export default App;

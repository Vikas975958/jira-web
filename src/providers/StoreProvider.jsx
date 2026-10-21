"use client";

import React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/store";
import { ToastContainer, toast } from "react-toastify";
import { ConfigProvider } from "antd";
import primary from "@/utils/theme";

// Silence success toasts globally so only errors are shown to the user
if (typeof window !== "undefined") {
  toast.success = () => null;
}

export default function StoreProvider({ children }) {
  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <p className="h-[100vh] w-full flex items-center justify-center">
            Loading...
          </p>
        }
        persistor={persistor}
      >
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: primary,
              borderRadius: 8,
              borderRadiusSM: 6,
              borderRadiusLG: 8,
            },
            components: {
              Select: {
                borderRadius: 8,
                borderRadiusSM: 6,
                borderRadiusLG: 8,
              },
              DatePicker: {
                borderRadius: 8,
                borderRadiusSM: 6,
                borderRadiusLG: 8,
              },
            },
          }}
        >
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          {children}
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

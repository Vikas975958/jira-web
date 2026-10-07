"use client";

import React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "@/store";
import { ToastContainer } from "react-toastify";

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
      </PersistGate>
    </Provider>
  );
}

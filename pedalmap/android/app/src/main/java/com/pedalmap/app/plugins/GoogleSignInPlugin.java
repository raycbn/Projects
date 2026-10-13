package com.pedalmap.app.plugins;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;

@CapacitorPlugin(name = "GoogleSignIn", requestCodes = {9001})
public class GoogleSignInPlugin extends Plugin {
  private static final String TAG = "GoogleSignInPlugin";
  private static final int RC_SIGN_IN = 9001;
  private PluginCall pendingCall;

  @PluginMethod
  public void signIn(PluginCall call) {
    String clientId = call.getString("clientId");
    Log.d(TAG, "signIn invoked clientId=" + clientId);
    if (clientId == null || clientId.isEmpty()) {
      call.reject("Missing Google client ID");
      return;
    }

    GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
      .requestIdToken(clientId)
      .requestEmail()
      .build();

    com.google.android.gms.auth.api.signin.GoogleSignInClient client = GoogleSignIn.getClient(getContext(), options);
    Intent intent = client.getSignInIntent();
    try {
      Log.d(TAG, "launching Google sign-in intent");
      startActivityForResult(call, intent, RC_SIGN_IN);
      pendingCall = call;
    } catch (Exception e) {
      Log.e(TAG, "Cannot launch Google sign-in", e);
      call.reject("Cannot launch Google sign-in", e);
    }
  }

  @Override
  protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
    Log.d(TAG, "handleOnActivityResult(requestCode=" + requestCode + ", resultCode=" + resultCode + ", dataPresent=" + (data != null) + ")");
    if (requestCode != RC_SIGN_IN) return;
    if (data == null) {
      Log.w(TAG, "Google sign-in: result data is null (canceled / no result)");
      if (pendingCall != null) {
        pendingCall.reject("Google sign-in: no result data");
        pendingCall = null;
      }
      return;
    }
    Bundle extras = data.getExtras();
    if (extras != null) Log.d(TAG, "Google sign-in result extras keys=" + extras.keySet());

    Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
    try {
      GoogleSignInAccount account = task.getResult(ApiException.class);
      if (account == null) {
        Log.w(TAG, "Google sign-in canceled: account null");
        if (pendingCall != null) {
          pendingCall.reject("Google sign-in canceled");
          pendingCall = null;
        }
        return;
      }

      String idToken = account.getIdToken();
      Log.d(TAG, "Google account idToken present=" + (idToken != null && !idToken.isEmpty()) + " email=" + account.getEmail());
      if (idToken == null || idToken.isEmpty()) {
        if (pendingCall != null) {
          pendingCall.reject("Google did not return an ID token");
          pendingCall = null;
        }
        return;
      }

      FirebaseAuth auth = FirebaseAuth.getInstance();
      com.google.firebase.auth.AuthCredential credential = GoogleAuthProvider.getCredential(idToken, null);
          Log.d(TAG, "signInWithCredential start");
          auth.signInWithCredential(credential)
            .addOnCompleteListener(task1 -> {
              Log.d(TAG, "signInWithCredential complete success=" + task1.isSuccessful());
              PluginCall call = pendingCall;
              pendingCall = null;
              if (call == null) return;

              if (!task1.isSuccessful()) {
                Exception ex = task1.getException();
                Log.e(TAG, "Firebase credential sign-in failed: " + (ex != null ? ex.getClass().getName() + ": " + ex.getMessage() : "null"), ex);
                call.reject("Firebase credential sign-in failed", ex);
                return;
              }

          JSObject result = new JSObject();
          result.put("uid", auth.getCurrentUser() != null ? auth.getCurrentUser().getUid() : null);
          result.put("email", account.getEmail());
          result.put("displayName", account.getDisplayName());
          result.put("photoURL", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : null);
          result.put("provider", "google.com");
          result.put("idToken", idToken);
          call.resolve(result);
        });
    } catch (ApiException e) {
      Log.e(TAG, "Google sign-in ApiException status=" + e.getStatusCode() + " msg=" + e.getMessage(), e);
      if (pendingCall != null) {
        pendingCall.reject("Google sign-in error: " + e.getStatusCode() + " (" + e.getMessage() + ")", e);
        pendingCall = null;
      }
    }
  }
}

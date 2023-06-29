const axios = require('axios');
const core = require('@actions/core');

const SCOPE = 'https://graph.microsoft.com/.default';
const AUTHORITY_HOST_URL = 'https://login.microsoftonline.com';
const GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

// Read inputs from workflow file
const AZURE_CLIENT_ID = core.getInput('AZURE_CLIENT_ID');
const AZURE_CLIENT_SECRET = core.getInput('AZURE_CLIENT_SECRET');
const AZURE_TENANT_ID = core.getInput('AZURE_TENANT_ID');

const AZURE_APP_NAME = core.getInput('AZURE_APP_NAME');
const AZURE_RESOURCE_TYPE = core.getInput('AZURE_RESOURCE_TYPE');
const AZURE_RESOURCE_NAME = core.getInput('AZURE_RESOURCE_NAME');
var AZURE_ROLE_NAME = core.getInput('AZURE_ROLE_NAME');

// Function to get access token
async function getAccessToken() {

    const data = `grant_type=client_credentials&client_id=${AZURE_CLIENT_ID}&client_secret=${AZURE_CLIENT_SECRET}&scope=${SCOPE}`;
    core.debug(`data: ${data}`);

    const config = {
        headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    return axios.post(`${AUTHORITY_HOST_URL}/${AZURE_TENANT_ID}/oauth2/v2.0/token`, data, config).then((response) => {
        core.debug(`token: ${response.data.access_token}`);
        return response.data.access_token;
    }).catch((error) => {
        var errorMessage = error.response.data.error.message;
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
    });
};

async function invokeGraphGet(token, url) {

    const config = {
        headers: {
        'Authorization': `Bearer ${token}`
        }
    };

    core.info(`Invoking GET ${url}`);

    return axios.get(url, config).then((response) => {
        return response.data;
    }).catch((error) => {
        var errorMessage = error.response.data.error.message;
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
    });

}

async function getApplicationFromName(token, appName) {
    var application = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/servicePrincipals?$filter=displayName eq '${appName}'`)

    if (application.value.length == 0) {
        var errorMessage = `Could not find app with name ${appName}`;
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
        return;
    }

    return application;
}

async function getUserFromName(token, userName) {
    var user = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/users?$filter=userPrincipalName eq '${userName}'`)

    if (user.value.length == 0) {
        var errorMessage = `Could not find user with name ${userName}`;
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
        return;
    }

    return user;
}

async function getGroupFromName(token, groupName) {
    var group = await invokeGraphGet(token, `${GRAPH_ENDPOINT}/groups?$filter=displayName eq '${groupName}'`)

    if (group.value.length == 0) {
        var errorMessage = `Could not find group with name ${groupName}`;
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
        return;
    }

    return group;
}

async function assignRole(token, appId, roleId, principalId) {

    const data = `{"principalId": "${principalId}","resourceId": "${appId}","appRoleId": "${roleId}"}`;
    const config = {
        headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
        }
    };

    var url = `${GRAPH_ENDPOINT}/servicePrincipals/${appId}/appRoleAssignments`;

    core.info(`Invoking POST ${url}`);

    return axios.post(url, data, config).then((response) => {
        core.info(`Role assigned successfully`)
        core.setOutput("message", `Role assigned successfully`)
        core.debug("result: " + JSON.stringify(response.data));
        return response.data;
    }).catch((error) => {
        var errorMessage = error.response.data.error.message;
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
    });

}

async function main() {

    // Check if all required environment variables are set
    if (AZURE_CLIENT_ID == null || AZURE_CLIENT_SECRET == null || AZURE_TENANT_ID == null) {
        var errorMessage = 'AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and AZURE_TENANT_ID must be set';
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
        return;
    }

    if (AZURE_APP_NAME == null || AZURE_RESOURCE_TYPE == null || AZURE_RESOURCE_NAME == null) {
        var errorMessage = 'AZURE_APP_NAME, AZURE_RESOURCE_TYPE and AZURE_RESOURCE_NAME must be set';
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
        return;
    }

    core.info(`Assigning role "${AZURE_ROLE_NAME}" to "${AZURE_RESOURCE_TYPE} ${AZURE_RESOURCE_NAME}" for app "${AZURE_APP_NAME}"`)

    var token = await getAccessToken();

    var app = await getApplicationFromName(token, AZURE_APP_NAME);
    
    // If no resource type is specified, use the type "User"
    if (AZURE_RESOURCE_TYPE == 'Group') {
        var group = await getGroupFromName(token, AZURE_RESOURCE_NAME);
    } else {
        var user = await getUserFromName(token, AZURE_RESOURCE_NAME);
    }

    // If no role name is specified, use the role with the name "User"
    if (AZURE_ROLE_NAME == null) {
        AZURE_ROLE_NAME = 'User';
    }

    var appId = app.value[0].id;
    var roleId = app.value[0].appRoles.filter(role => role.displayName == AZURE_ROLE_NAME)[0].id;
    var principalId = AZURE_RESOURCE_TYPE == 'Group' ? group.value[0].id : user.value[0].id;

    if (appId == null || roleId == null || principalId == null) {
        var errorMessage = 'Could not find app, role or principal';
        core.setOutput("message", errorMessage)
        core.setFailed(errorMessage);
        return;
    }
    
    var result = await assignRole(token, appId, roleId, principalId);

}

main();